/**
 * Recruit Thread
 * ------------------------------------------------------------
 * 責務: 募集ごとのスレッド / フォーラム投稿の作成と、参加者の追加。
 *
 *   thread_mode = "thread" : 募集投稿からスレッドを作成
 *   thread_mode = "forum"  : 設定されたフォーラムチャンネルに投稿を作成
 *                            （未設定・作成失敗時はスレッド方式にフォールバック）
 *
 *   - 募集者は作成時に、参加者は参加ボタンを押した時点でスレッドに追加する
 *   - 締切後もスレッドは残す（集合・連絡に使えるように）
 *   - 失敗しても募集自体は成立させる（ログのみ）
 */
import { ChannelType, ThreadAutoArchiveDuration } from "discord.js";
import { t } from "../../utils/i18n.js";

const THREAD_NAME_MAX = 100;
const MESSAGE_MAX     = 2000;

async function fetchChannel(client, channelId) {
  return client.channels.cache.get(channelId)
    ?? await client.channels.fetch(channelId).catch(() => null);
}

function truncate(str, max) {
  const text = String(str ?? "");
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export function recruitPostUrl(recruit) {
  return `https://discord.com/channels/${recruit.guild_id}/${recruit.channel_id}/${recruit.message_id}`;
}

function buildForumStarter(recruit, lang) {
  const lines = [
    t(lang, "commands.recruit.thread_starter", { title: recruit.title }),
    t(lang, "commands.recruit.notice_host", { host: `<@${recruit.author_id}>` }),
  ];
  if (recruit.description) lines.push("", recruit.description);
  lines.push("", t(lang, "commands.recruit.thread_starter_link", { url: recruitPostUrl(recruit) }));
  return truncate(lines.join("\n"), MESSAGE_MAX);
}

/**
 * @param {import("discord.js").Client} client
 * @param {object} recruit  message_id 設定済みの recruits 行
 * @param {import("discord.js").Message} message  募集投稿
 * @param {{ thread_mode: string, forum_channel_id: string|null }} settings
 * @returns {Promise<{ id: string, kind: "thread"|"forum" } | null>}
 */
export async function createRecruitThread(client, recruit, message, settings) {
  const lang = recruit.lang ?? "en";
  const name = truncate(recruit.title, THREAD_NAME_MAX);
  let thread = null;
  let kind   = null;

  if (settings.thread_mode === "forum" && settings.forum_channel_id) {
    const forum = await fetchChannel(client, settings.forum_channel_id);
    if (forum?.type === ChannelType.GuildForum) {
      thread = await forum.threads
        .create({
          name,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
          message: {
            content: buildForumStarter(recruit, lang),
            allowedMentions: { parse: [] },
          },
        })
        .catch((err) => {
          console.error(`[recruit-thread] forum post failed: recruit=${recruit.id}`, err?.message ?? err);
          return null;
        });
      if (thread) kind = "forum";
    } else {
      console.warn(`[recruit-thread] forum channel unavailable: guild=${recruit.guild_id} channel=${settings.forum_channel_id}`);
    }
  }

  if (!thread) {
    // スレッドの中や、スレッドを作れないチャンネルの投稿からは作らない
    const channel   = message?.channel;
    const canThread =
      channel &&
      !(typeof channel.isThread === "function" && channel.isThread()) &&
      (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement);

    if (canThread && typeof message.startThread === "function") {
      thread = await message
        .startThread({ name, autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek })
        .catch((err) => {
          console.error(`[recruit-thread] thread creation failed: recruit=${recruit.id}`, err?.message ?? err);
          return null;
        });
      if (thread) kind = "thread";
    }
  }

  if (!thread) return null;

  await thread.members?.add(recruit.author_id).catch(() => {});
  return { id: thread.id, kind };
}

/**
 * 参加者をスレッドに追加する（アーカイブ済みなら再開してから追加）。
 */
export async function addMemberToRecruitThread(client, recruit, userId) {
  if (!recruit?.thread_id) return;
  const thread = await fetchChannel(client, recruit.thread_id);
  if (!thread || !(typeof thread.isThread === "function" && thread.isThread())) return;

  if (thread.archived) await thread.setArchived(false).catch(() => {});
  await thread.members.add(userId).catch(() => {});
}
