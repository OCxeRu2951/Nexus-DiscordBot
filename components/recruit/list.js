/**
 * Recruit List（更新リスト）
 * ------------------------------------------------------------
 * 責務: 設定されたチャンネルに「現在募集中の一覧」を1つの投稿として置き、
 * 募集の作成・参加・取消・締切のたびに同じ投稿を編集して最新化する。
 *
 *   - 短時間に連続した操作は LIST_DEBOUNCE_MS でまとめて1回の編集にする
 *     （同一チャンネルへの連続編集によるレート制限を避けるため）
 *   - 同一サーバーの更新は直列化し、投稿の二重作成を防ぐ
 *   - リスト投稿が削除されていた場合は作り直す
 *   - リストのチャンネルが変更・無効化された場合は、旧チャンネルの投稿を削除する
 */
import { EmbedBuilder, escapeMarkdown } from "discord.js";
import { db } from "../../utils/db.js";
import { t, resolveLang } from "../../utils/i18n.js";
import { getRecruitSettings, setListMessage } from "./settings.js";

const COLOR_LIST        = 0xf07830;
const LIST_DEBOUNCE_MS  = 2000;
const DESCRIPTION_MAX   = 4096;
const LIST_TITLE_MAX    = 80;
const UNKNOWN_MESSAGE   = 10008;

const pendingUpdates = new Map(); // guildId → Timeout
const runningUpdates = new Map(); // guildId → Promise

async function fetchChannel(client, channelId) {
  return client.channels.cache.get(channelId)
    ?? await client.channels.fetch(channelId).catch(() => null);
}

function truncate(str, max) {
  const text = String(str ?? "");
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function linkText(text) {
  // リンク文字列内の [] と Markdown 記号をエスケープ
  return escapeMarkdown(text).replace(/([[\]])/g, "\\$1");
}

export async function loadOpenRecruits(guildId) {
  const { rows } = await db.execute({
    sql: `SELECT r.*,
                 (SELECT COUNT(*) FROM recruit_members m WHERE m.recruit_id = r.id) AS member_count
          FROM recruits r
          WHERE r.guild_id = ? AND r.status = 'open'
          ORDER BY (r.end_at IS NULL), r.end_at ASC, r.created_at ASC`,
    args: [guildId],
  });
  return rows;
}

/**
 * 募集中の一覧Embedを組み立てる（締切が近い順、締切なしは最後）。
 */
export function buildRecruitListEmbed(guildId, recruits, lang) {
  const embed = new EmbedBuilder()
    .setTitle(t(lang, "commands.recruit.list_title", { count: recruits.length }))
    .setColor(COLOR_LIST)
    .setFooter({ text: t(lang, "commands.recruit.list_footer") })
    .setTimestamp();

  if (recruits.length === 0) {
    return embed.setDescription(t(lang, "commands.recruit.list_empty"));
  }

  const blocks = [];
  let length = 0;

  for (let i = 0; i < recruits.length; i++) {
    const r        = recruits[i];
    const count    = Number(r.member_count ?? 0);
    const title    = linkText(truncate(r.title, LIST_TITLE_MAX));
    const heading  = r.message_id
      ? `**[${title}](https://discord.com/channels/${guildId}/${r.channel_id}/${r.message_id})**`
      : `**${title}**`;

    const details = [
      r.capacity != null
        ? t(lang, "commands.recruit.list_count", { count, capacity: Number(r.capacity) })
        : t(lang, "commands.recruit.list_count_unlimited", { count }),
      r.end_at != null
        ? t(lang, "commands.recruit.list_deadline", { time: `<t:${Math.floor(Number(r.end_at) / 1000)}:R>` })
        : null,
      t(lang, "commands.recruit.list_host", { host: `<@${r.author_id}>` }),
      r.thread_id
        ? `[${t(lang, r.thread_kind === "forum" ? "commands.recruit.list_forum_link" : "commands.recruit.list_thread_link")}](https://discord.com/channels/${guildId}/${r.thread_id})`
        : null,
    ].filter(Boolean).join(" ・ ");

    const block   = `${heading}\n${details}`;
    const reserve = i < recruits.length - 1 ? 40 : 0; // 「他N件」の分
    if (length + block.length + 2 + reserve > DESCRIPTION_MAX) {
      blocks.push(t(lang, "commands.recruit.list_more", { count: recruits.length - i }));
      break;
    }
    blocks.push(block);
    length += block.length + 2;
  }

  return embed.setDescription(blocks.join("\n\n"));
}

async function fetchListMessage(channel, messageId) {
  try {
    return await channel.messages.fetch(messageId);
  } catch (err) {
    // 削除済みの場合のみ作り直す。一時的なエラーで二重投稿しないよう、それ以外は投げる
    if (err?.code === UNKNOWN_MESSAGE) return null;
    throw err;
  }
}

async function doUpdate(client, guildId) {
  const settings = await getRecruitSettings(guildId);

  // チャンネル変更・無効化された場合は、旧チャンネルのリスト投稿を片付ける
  if (
    settings.list_message_id &&
    settings.list_message_channel_id &&
    settings.list_message_channel_id !== settings.list_channel_id
  ) {
    const oldChannel = await fetchChannel(client, settings.list_message_channel_id);
    const oldMessage = await oldChannel?.messages?.fetch(settings.list_message_id).catch(() => null);
    await oldMessage?.delete().catch(() => {});
    await setListMessage(guildId, null, null);
    settings.list_message_id = null;
  }

  if (!settings.list_channel_id) return "disabled";

  const channel = await fetchChannel(client, settings.list_channel_id);
  if (!channel?.messages || typeof channel.send !== "function") {
    console.error(`[recruit-list] channel unavailable: guild=${guildId} channel=${settings.list_channel_id}`);
    return "channel_unavailable";
  }

  const lang     = await resolveLang({ guildId });
  const recruits = await loadOpenRecruits(guildId);
  const payload  = {
    embeds: [buildRecruitListEmbed(guildId, recruits, lang)],
    allowedMentions: { parse: [] },
  };

  if (settings.list_message_id) {
    const message = await fetchListMessage(channel, settings.list_message_id);
    if (message) {
      await message.edit(payload);
      return "edited";
    }
  }

  const sent = await channel.send(payload);
  await setListMessage(guildId, channel.id, sent.id);
  return "created";
}

/**
 * 即時に更新する。同一サーバーの更新は直列に実行する。
 * @returns {Promise<"disabled"|"channel_unavailable"|"edited"|"created">}
 */
export async function updateRecruitList(client, guildId) {
  const previous = runningUpdates.get(guildId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => doUpdate(client, guildId));
  runningUpdates.set(guildId, next);
  try {
    return await next;
  } finally {
    if (runningUpdates.get(guildId) === next) runningUpdates.delete(guildId);
  }
}

/**
 * 連続操作をまとめて、少し待ってから更新する（通常はこちらを使う）。
 */
export function scheduleRecruitListUpdate(client, guildId, delay = LIST_DEBOUNCE_MS) {
  if (!guildId) return;
  clearTimeout(pendingUpdates.get(guildId));
  pendingUpdates.set(
    guildId,
    setTimeout(() => {
      pendingUpdates.delete(guildId);
      updateRecruitList(client, guildId).catch((err) =>
        console.error(`[recruit-list] update failed: guild=${guildId}`, err),
      );
    }, delay),
  );
}

/**
 * 起動時: 更新リストが設定されている全サーバーを最新化する。
 */
export async function refreshAllRecruitLists(client) {
  const { rows } = await db
    .execute(`SELECT guild_id FROM recruit_settings WHERE list_channel_id IS NOT NULL OR list_message_id IS NOT NULL`)
    .catch(() => ({ rows: [] }));

  for (const { guild_id: guildId } of rows) {
    if (!client.guilds.cache.has(guildId)) continue;
    await updateRecruitList(client, guildId).catch((err) =>
      console.error(`[recruit-list] refresh failed: guild=${guildId}`, err),
    );
  }
}
