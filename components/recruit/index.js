/**
 * Recruit Component
 * ------------------------------------------------------------
 * 責務: 募集（/recruit）のDB操作・Embed/ボタン生成・締切処理・ボタンハンドラ。
 * Slashコマンド本体は commands/recruit.js、ボタンの振り分けは interactionCreate.js。
 *
 * 仕様:
 *   - 参加 / 取消 / 締切 の3ボタン
 *   - 定員到達・締切時刻・手動締切（募集者 or メッセージ管理権限者）でクローズ
 *   - クローズ時は募集投稿へ返信する形で、募集者と参加者をメンションして通知
 *   - 募集Embedの言語は作成時の言語（recruits.lang）で固定する
 *     （他ユーザーのボタン操作で表示言語が切り替わらないようにするため）
 *   - 定員・締切の判定はSQL 1文で行い、同時押しでも定員を超えない
 *   - 作成時にスレッド / フォーラム投稿を作成（thread.js）
 *   - 作成・参加・取消・締切のたびに更新リストを更新（list.js）
 */
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { db } from "../../utils/db.js";
import { t } from "../../utils/i18n.js";
import { getRecruitSettings } from "./settings.js";
import { scheduleRecruitListUpdate } from "./list.js";
import { createRecruitThread, addMemberToRecruitThread } from "./thread.js";

const COLOR_OPEN   = 0xf07830;
const COLOR_CLOSED = 0x95a5a6;

// 締切済みの募集を保持する日数（ready.js の定期クリーンアップで削除）
export const RECRUIT_RETENTION_DAYS = 30;

// Discord の上限
const EMBED_TITLE_MAX   = 256;
const EMBED_FIELD_MAX   = 1024;
const MESSAGE_MAX       = 2000;

// recruitId → Timeout（締切タイマー）
const closeTimers = new Map();

// ---- 取得 ----

export async function getRecruit(id) {
  const { rows } = await db.execute({
    sql:  `SELECT * FROM recruits WHERE id = ?`,
    args: [id],
  });
  return rows[0] ?? null;
}

export async function getMemberIds(id) {
  const { rows } = await db.execute({
    sql:  `SELECT user_id FROM recruit_members WHERE recruit_id = ? ORDER BY joined_at ASC`,
    args: [id],
  });
  return rows.map((r) => String(r.user_id));
}

// ---- 作成 ----

/**
 * Discord上の表示名（サーバーニックネーム → グローバル表示名 → ユーザー名）。
 * ダッシュボードで参加者を名前表示するためにDBへ保存する。
 */
export function displayNameOf(member, user) {
  return member?.displayName ?? member?.nick ?? user?.globalName ?? user?.username ?? null;
}

/**
 * ダッシュボードで「誰がこの募集を見てよいか」を判定する基準のチャンネル。
 *   通常チャンネル → そのチャンネル
 *   公開スレッド   → 親チャンネル
 *   非公開スレッド → null（ダッシュボードでは管理者のみ閲覧可）
 */
export function visibilityChannelIdOf(channel) {
  if (!channel) return null;
  if (typeof channel.isThread === "function" && channel.isThread()) {
    return channel.type === ChannelType.PrivateThread ? null : (channel.parentId ?? null);
  }
  return channel.id ?? null;
}

export async function createRecruit({
  guildId, channelId, viewChannelId, authorId, authorName, title, description, capacity, endAt, lang,
}) {
  const result = await db.execute({
    sql: `INSERT INTO recruits (guild_id, channel_id, view_channel_id, author_id, author_name, title, description, capacity, end_at, lang, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    args: [
      guildId, channelId, viewChannelId ?? null, authorId, authorName ?? null, title,
      description ?? null, capacity ?? null, endAt ?? null, lang, Date.now(),
    ],
  });
  return Number(result.lastInsertRowid);
}

export async function attachRecruitMessage(id, messageId) {
  await db.execute({
    sql:  `UPDATE recruits SET message_id = ? WHERE id = ?`,
    args: [messageId, id],
  });
}

/**
 * 募集を作成して投稿する（/recruit と b! の共通処理）。
 *
 * @param {import("discord.js").Client} client
 * @param {object}   params
 * @param {(payload: object) => Promise<import("discord.js").Message>} params.send
 *   募集Embedを投稿し、投稿したMessageを返す関数（Slash: editReply / Prefix: reply）
 * @param {(payload: object) => Promise<unknown>} [params.edit]
 *   投稿を編集する関数（省略時は message.edit）。スレッドのリンクを追記するのに使う
 * @param {boolean} [params.createThread=true] スレッド / フォーラム投稿を作成するか
 * @returns {Promise<{ id: number, message: import("discord.js").Message, threadId: string|null }>}
 */
export async function publishRecruit(client, {
  send, edit, guildId, channelId, viewChannelId, authorId, authorName,
  title, description, capacity, endAt, lang, createThread = true,
}) {
  const id = await createRecruit({
    guildId, channelId, viewChannelId, authorId, authorName, title, description, capacity, endAt, lang,
  });
  let recruit = await getRecruit(id);

  let message;
  try {
    message = await send(buildRecruitPayload(recruit, []));
  } catch (err) {
    // 投稿できなかった募集はボタンから操作できないため残さない
    await db.execute({ sql: `DELETE FROM recruits WHERE id = ?`, args: [id] }).catch(() => {});
    throw err;
  }

  await attachRecruitMessage(id, message.id);
  recruit = { ...recruit, message_id: message.id };

  if (endAt) scheduleRecruitClose(client, recruit);

  // ---- スレッド / フォーラム投稿 ----
  let threadId = null;
  if (createThread) {
    const settings = await getRecruitSettings(guildId);
    const created  = await createRecruitThread(client, recruit, message, settings);
    if (created) {
      threadId = created.id;
      await db.execute({
        sql:  `UPDATE recruits SET thread_id = ?, thread_kind = ? WHERE id = ?`,
        args: [created.id, created.kind, id],
      });
      recruit = { ...recruit, thread_id: created.id, thread_kind: created.kind };
      const payload = buildRecruitPayload(recruit, []);
      await (edit ? edit(payload) : message.edit(payload)).catch(console.error);
    }
  }

  scheduleRecruitListUpdate(client, guildId);
  return { id, message, threadId };
}

// ---- 参加 / 取消 ----

/**
 * @returns {Promise<{ ok: true, filled: boolean } | { ok: false, reason: "not_found"|"already"|"closed"|"full" }>}
 */
export async function joinRecruit(id, userId, username = null) {
  const now = Date.now();

  // 募集中・締切前・定員未満の場合のみ挿入（1文で判定するため同時押しでも定員を超えない）
  const result = await db.execute({
    sql: `INSERT OR IGNORE INTO recruit_members (recruit_id, guild_id, user_id, username, joined_at)
          SELECT r.id, r.guild_id, ?, ?, ?
          FROM recruits r
          WHERE r.id = ?
            AND r.status = 'open'
            AND (r.end_at IS NULL OR r.end_at > ?)
            AND (r.capacity IS NULL
                 OR (SELECT COUNT(*) FROM recruit_members m WHERE m.recruit_id = r.id) < r.capacity)`,
    args: [userId, username, now, id, now],
  });

  const recruit = await getRecruit(id);
  if (!recruit) return { ok: false, reason: "not_found" };

  const memberIds = await getMemberIds(id);

  if (result.rowsAffected === 0) {
    if (memberIds.includes(userId)) return { ok: false, reason: "already" };
    if (recruit.status !== "open" || (recruit.end_at != null && Number(recruit.end_at) <= now)) {
      return { ok: false, reason: "closed" };
    }
    return { ok: false, reason: "full" };
  }

  const filled = recruit.capacity != null && memberIds.length >= Number(recruit.capacity);
  return { ok: true, filled };
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, reason: "not_found"|"closed"|"not_joined" }>}
 */
export async function leaveRecruit(id, userId) {
  const result = await db.execute({
    sql: `DELETE FROM recruit_members
          WHERE recruit_id = ? AND user_id = ?
            AND EXISTS (SELECT 1 FROM recruits WHERE id = ? AND status = 'open')`,
    args: [id, userId, id],
  });

  if (result.rowsAffected > 0) return { ok: true };

  const recruit = await getRecruit(id);
  if (!recruit) return { ok: false, reason: "not_found" };
  if (recruit.status !== "open") return { ok: false, reason: "closed" };
  return { ok: false, reason: "not_joined" };
}

// ---- 表示 ----

function truncate(str, max) {
  const text = String(str ?? "");
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

/**
 * メンション列を上限文字数内に収める。収まらない分は「他N人」にまとめる。
 */
function joinMentions(ids, separator, maxLength, lang) {
  const parts = [];
  let length  = 0;

  for (let i = 0; i < ids.length; i++) {
    const mention = `<@${ids[i]}>`;
    const rest    = ids.length - i - 1;
    // 以降を省略する場合に付く「他N人」の分も見込んでおく
    const reserve = rest > 0 ? 20 : 0;
    const added   = (parts.length > 0 ? separator.length : 0) + mention.length;

    if (length + added + reserve > maxLength) {
      parts.push(t(lang, "commands.recruit.members_more", { count: ids.length - i }));
      return parts.join(separator);
    }
    parts.push(mention);
    length += added;
  }
  return parts.join(separator);
}

function toUnix(ms) {
  return Math.floor(Number(ms) / 1000);
}

export function buildRecruitPayload(recruit, memberIds) {
  const lang     = recruit.lang ?? "en";
  const closed   = recruit.status === "closed";
  const capacity = recruit.capacity == null ? null : Number(recruit.capacity);
  const count    = memberIds.length;

  const title = closed
    ? `${t(lang, "commands.recruit.closed_tag")} ${recruit.title}`
    : recruit.title;

  const embed = new EmbedBuilder()
    .setTitle(truncate(title, EMBED_TITLE_MAX))
    .setColor(closed ? COLOR_CLOSED : COLOR_OPEN)
    .setFooter({ text: t(lang, "commands.recruit.footer", { id: recruit.id }) })
    .setTimestamp(Number(recruit.created_at));

  if (recruit.description) embed.setDescription(recruit.description);

  embed.addFields(
    {
      name:   t(lang, "commands.recruit.field_host"),
      value:  `<@${recruit.author_id}>`,
      inline: true,
    },
    {
      name:   t(lang, "commands.recruit.field_count"),
      value:  capacity != null
        ? `${count} / ${capacity}`
        : t(lang, "commands.recruit.count_unlimited", { count }),
      inline: true,
    },
    {
      name:   t(lang, "commands.recruit.field_deadline"),
      value:  recruit.end_at != null
        ? `<t:${toUnix(recruit.end_at)}:f> (<t:${toUnix(recruit.end_at)}:R>)`
        : t(lang, "commands.recruit.deadline_none"),
      inline: true,
    },
  );

  if (recruit.thread_id) {
    embed.addFields({
      name:  t(lang, recruit.thread_kind === "forum" ? "commands.recruit.field_forum" : "commands.recruit.field_thread"),
      value: `[${t(lang, "commands.recruit.thread_link")}](https://discord.com/channels/${recruit.guild_id}/${recruit.thread_id})`,
    });
  }

  if (closed) {
    embed.addFields({
      name:  t(lang, "commands.recruit.field_status"),
      value: t(lang, `commands.recruit.reason_${recruit.close_reason ?? "manual"}`),
    });
  }

  embed.addFields({
    name:  t(lang, "commands.recruit.field_members"),
    value: count > 0
      ? joinMentions(memberIds, "\n", EMBED_FIELD_MAX, lang)
      : t(lang, "commands.recruit.members_none"),
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`recruit_join_${recruit.id}`)
      .setLabel(t(lang, "commands.recruit.join_btn"))
      .setStyle(ButtonStyle.Success)
      .setDisabled(closed),
    new ButtonBuilder()
      .setCustomId(`recruit_leave_${recruit.id}`)
      .setLabel(t(lang, "commands.recruit.leave_btn"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(closed),
    new ButtonBuilder()
      .setCustomId(`recruit_close_${recruit.id}`)
      .setLabel(t(lang, "commands.recruit.close_btn"))
      .setStyle(ButtonStyle.Danger)
      .setDisabled(closed),
  );

  return { embeds: [embed], components: [row] };
}

export async function loadRecruitPayload(id) {
  const recruit = await getRecruit(id);
  if (!recruit) return null;
  return buildRecruitPayload(recruit, await getMemberIds(id));
}

// ---- 締切 ----

async function fetchChannel(client, channelId) {
  return client.channels.cache.get(channelId)
    ?? await client.channels.fetch(channelId).catch(() => null);
}

/**
 * 募集を締め切る。すでに締切済みなら何もしない。
 *
 * @param {import("discord.js").Client} client
 * @param {number} id
 * @param {"full"|"deadline"|"manual"} reason
 * @param {{ editMessage?: boolean }} [options]
 *   editMessage=false の場合、募集投稿の更新は呼び出し側（ボタン操作）で行う
 * @returns {Promise<boolean>} この呼び出しで締め切った場合 true
 */
export async function closeRecruit(client, id, reason, { editMessage = true } = {}) {
  const result = await db.execute({
    sql:  `UPDATE recruits SET status = 'closed', close_reason = ?, closed_at = ? WHERE id = ? AND status = 'open'`,
    args: [reason, Date.now(), id],
  });

  const timer = closeTimers.get(id);
  if (timer) { clearTimeout(timer); closeTimers.delete(id); }

  // 別経路（同時押し・タイマー）で締切済み
  if (result.rowsAffected === 0) return false;

  const recruit = await getRecruit(id);
  if (!recruit) return true;

  scheduleRecruitListUpdate(client, recruit.guild_id);

  const memberIds = await getMemberIds(id);
  const lang      = recruit.lang ?? "en";
  const channel   = await fetchChannel(client, recruit.channel_id);
  if (!channel) return true;

  if (editMessage && recruit.message_id) {
    const message = await channel.messages.fetch(recruit.message_id).catch(() => null);
    if (message) {
      await message.edit(buildRecruitPayload(recruit, memberIds)).catch(console.error);
    }
  }

  // 締切通知（募集投稿への返信）
  const header = [
    t(lang, `commands.recruit.notice_${reason}`, { title: recruit.title }),
    t(lang, "commands.recruit.notice_host", { host: `<@${recruit.author_id}>` }),
  ].join("\n");

  const membersLine = memberIds.length > 0
    ? t(lang, "commands.recruit.notice_members", {
        members: joinMentions(memberIds, " ", MESSAGE_MAX - header.length - 50, lang),
      })
    : t(lang, "commands.recruit.notice_no_members");

  await channel
    .send({
      content: truncate(`${header}\n${membersLine}`, MESSAGE_MAX),
      reply: recruit.message_id
        ? { messageReference: recruit.message_id, failIfNotExists: false }
        : undefined,
      // タイトル等に @everyone が含まれていても反応させない
      allowedMentions: { users: [recruit.author_id, ...memberIds], repliedUser: false },
    })
    .catch(console.error);

  return true;
}

export function scheduleRecruitClose(client, row) {
  if (row.end_at == null) return;

  const id = Number(row.id);
  const existing = closeTimers.get(id);
  if (existing) clearTimeout(existing);

  const remaining = Number(row.end_at) - Date.now();
  if (remaining <= 0) {
    closeRecruit(client, id, "deadline").catch(console.error);
    return;
  }

  closeTimers.set(
    id,
    setTimeout(() => {
      closeTimers.delete(id);
      closeRecruit(client, id, "deadline").catch(console.error);
    }, remaining),
  );
}

// ---- 起動時・定期処理（ready.js から呼ぶ） ----

export async function restoreRecruits(client) {
  try {
    const { rows } = await db.execute(
      `SELECT * FROM recruits WHERE status = 'open' AND end_at IS NOT NULL`,
    );
    for (const row of rows) scheduleRecruitClose(client, row);
    if (rows.length > 0) console.log(`Restored ${rows.length} recruit(s).`);
  } catch (err) {
    console.error("Failed to restore recruits:", err);
  }
}

export async function purgeClosedRecruits() {
  const threshold = Date.now() - RECRUIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  await db
    .batch(
      [
        {
          sql:  `DELETE FROM recruit_members WHERE recruit_id IN
                   (SELECT id FROM recruits WHERE status = 'closed' AND closed_at < ?)`,
          args: [threshold],
        },
        {
          sql:  `DELETE FROM recruits WHERE status = 'closed' AND closed_at < ?`,
          args: [threshold],
        },
      ],
      "write",
    )
    .catch(console.error);
}

// ---- ボタンハンドラ（interactionCreate.js から呼ぶ） ----

export async function handleRecruitButton(interaction, lang) {
  // customId: recruit_{join|leave|close}_{recruitId}
  const [, action, idStr] = interaction.customId.split("_");
  const id = Number(idStr);

  // DB処理の遅延で3秒制限を超えないよう先に応答しておく
  await interaction.deferUpdate();

  const notify = (key, vars) =>
    interaction
      .followUp({ content: t(lang, key, vars), flags: MessageFlags.Ephemeral })
      .catch(() => {});

  const refresh = async () => {
    const payload = await loadRecruitPayload(id);
    if (payload) await interaction.editReply(payload).catch(console.error);
  };

  if (action === "join") {
    const res = await joinRecruit(
      id,
      interaction.user.id,
      displayNameOf(interaction.member, interaction.user),
    );
    if (!res.ok) {
      // 締切時刻を過ぎていたがタイマー発火前だった場合は、ここで締め切る
      if (res.reason === "closed") {
        const recruit = await getRecruit(id);
        if (recruit?.status === "open") {
          await closeRecruit(interaction.client, id, "deadline", { editMessage: false });
        }
        await refresh();
      }
      return notify(`commands.recruit.error_${res.reason}`);
    }

    const recruit = await getRecruit(id);
    await addMemberToRecruitThread(interaction.client, recruit, interaction.user.id);

    if (res.filled) {
      // 締切処理の中で更新リストも更新される
      await closeRecruit(interaction.client, id, "full", { editMessage: false });
    } else {
      scheduleRecruitListUpdate(interaction.client, recruit?.guild_id);
    }
    return refresh();
  }

  if (action === "leave") {
    const res = await leaveRecruit(id, interaction.user.id);
    if (!res.ok) return notify(`commands.recruit.error_${res.reason}`);
    const recruit = await getRecruit(id);
    scheduleRecruitListUpdate(interaction.client, recruit?.guild_id);
    return refresh();
  }

  if (action === "close") {
    const recruit = await getRecruit(id);
    if (!recruit) return notify("commands.recruit.error_not_found");

    const isAuthor  = recruit.author_id === interaction.user.id;
    const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ?? false;
    if (!isAuthor && !canManage) return notify("commands.recruit.error_forbidden");

    const closed = await closeRecruit(interaction.client, id, "manual", { editMessage: false });
    if (!closed) return notify("commands.recruit.error_closed");
    return refresh();
  }
}
