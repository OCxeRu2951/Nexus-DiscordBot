/**
 * Recruit Settings
 * ------------------------------------------------------------
 * 責務: サーバーごとの募集設定（recruit_settings）の読み書きだけ。
 * /recruit-config とダッシュボードの両方から同じテーブルを更新する。
 *
 *   list_channel_id          更新リスト（募集一覧）を置くチャンネル。NULL なら無効
 *   list_message_id          更新リストの投稿ID（Botが管理）
 *   list_message_channel_id  上記投稿が実際にあるチャンネル（チャンネル変更の検知用）
 *   thread_mode              'thread' | 'forum'
 *   forum_channel_id         thread_mode = 'forum' のときの投稿先
 *   viewer_role_ids          ダッシュボードで募集を閲覧できるロール（JSON配列）。空なら全員
 */
import { db } from "../../utils/db.js";

export const THREAD_MODES = ["thread", "forum"];
export const VIEWER_ROLES_MAX = 25;

const DEFAULTS = {
  list_channel_id:         null,
  list_message_id:         null,
  list_message_channel_id: null,
  thread_mode:             "thread",
  forum_channel_id:        null,
  viewer_role_ids:         [],
};

export function parseRoleIds(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function getRecruitSettings(guildId) {
  const { rows } = await db
    .execute({ sql: `SELECT * FROM recruit_settings WHERE guild_id = ?`, args: [guildId] })
    .catch(() => ({ rows: [] }));

  const row = rows[0];
  if (!row) return { guild_id: guildId, ...DEFAULTS };

  return {
    guild_id:                guildId,
    list_channel_id:         row.list_channel_id ?? null,
    list_message_id:         row.list_message_id ?? null,
    list_message_channel_id: row.list_message_channel_id ?? null,
    thread_mode:             THREAD_MODES.includes(row.thread_mode) ? row.thread_mode : "thread",
    forum_channel_id:        row.forum_channel_id ?? null,
    viewer_role_ids:         parseRoleIds(row.viewer_role_ids),
  };
}

async function ensureRow(guildId) {
  await db.execute({
    sql:  `INSERT OR IGNORE INTO recruit_settings (guild_id) VALUES (?)`,
    args: [guildId],
  });
}

export async function setListChannel(guildId, channelId) {
  await ensureRow(guildId);
  await db.execute({
    sql:  `UPDATE recruit_settings SET list_channel_id = ? WHERE guild_id = ?`,
    args: [channelId ?? null, guildId],
  });
}

export async function setListMessage(guildId, channelId, messageId) {
  await ensureRow(guildId);
  await db.execute({
    sql:  `UPDATE recruit_settings SET list_message_channel_id = ?, list_message_id = ? WHERE guild_id = ?`,
    args: [channelId ?? null, messageId ?? null, guildId],
  });
}

export async function setThreadMode(guildId, mode, forumChannelId) {
  if (!THREAD_MODES.includes(mode)) throw new Error(`Invalid thread mode: ${mode}`);
  await ensureRow(guildId);
  // フォーラムチャンネル未指定の場合は既存の設定を残す
  await db.execute({
    sql:  `UPDATE recruit_settings SET thread_mode = ?, forum_channel_id = COALESCE(?, forum_channel_id) WHERE guild_id = ?`,
    args: [mode, forumChannelId ?? null, guildId],
  });
}

export async function setViewerRoles(guildId, roleIds) {
  const unique = [...new Set(roleIds.map(String))].slice(0, VIEWER_ROLES_MAX);
  await ensureRow(guildId);
  await db.execute({
    sql:  `UPDATE recruit_settings SET viewer_role_ids = ? WHERE guild_id = ?`,
    args: [unique.length > 0 ? JSON.stringify(unique) : null, guildId],
  });
  return unique;
}
