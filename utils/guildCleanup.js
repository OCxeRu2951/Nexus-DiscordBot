/**
 * Guild Deletion Queue
 * ------------------------------------------------------------
 * Botがサーバーから抜けた際、即座にデータを消さず30日間の猶予を設ける。
 * 猶予期間中に再参加した場合は削除予約をキャンセルする。
 *
 *   guildDelete → scheduleGuildDeletion() で30日後の削除を予約
 *   guildCreate → cancelGuildDeletion() で予約をキャンセル
 *   ready.js    → 定期的に purgeExpiredGuilds() を呼び、期限切れの予約を実行
 */
import { db } from "./db.js";

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30日

// guild_id を持つテーブル一覧（削除対象）
// 注: reminders / afk は user_id ベースで guild_id 列を持たないため対象外。
//     poll_votes は poll_id ベースで guild_id 列を持たないため、
//     polls 経由のサブクエリで別途削除する。
const GUILD_SCOPED_TABLES = [
  "warnings",
  "mod_notes",
  "mod_logs",
  "mod_settings",
  "settings",
  "applications",
  "apply_settings",
  "guild_settings",
  "hourly_messages",
  "guild_lang",
  "guild_prefix_settings",
  "prefix_channel_settings",
  "recruits",
  "recruit_members",
  "recruit_settings",
  "recruit_actions",
];

export async function scheduleGuildDeletion(guildId) {
  const scheduledAt = Date.now() + GRACE_PERIOD_MS;
  await db
    .execute({
      sql: `INSERT INTO guild_deletion_queue (guild_id, scheduled_at) VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET scheduled_at = ?`,
      args: [guildId, scheduledAt, scheduledAt],
    })
    .catch(console.error);
}

export async function cancelGuildDeletion(guildId) {
  await db
    .execute({
      sql: `DELETE FROM guild_deletion_queue WHERE guild_id = ?`,
      args: [guildId],
    })
    .catch(console.error);
}

/**
 * 指定guildの全データを完全削除する。
 * 予約経由・即時実行のどちらからも呼べるよう独立関数にしている。
 */
export async function purgeGuildData(guildId) {
  // poll_votes は guild_id を持たないため polls 経由で削除
  await db
    .execute({
      sql: `DELETE FROM poll_votes WHERE poll_id IN (SELECT id FROM polls WHERE guild_id = ?)`,
      args: [guildId],
    })
    .catch(console.error);

  await db
    .execute({ sql: `DELETE FROM polls WHERE guild_id = ?`, args: [guildId] })
    .catch(console.error);

  for (const table of GUILD_SCOPED_TABLES) {
    await db
      .execute({
        sql: `DELETE FROM ${table} WHERE guild_id = ?`,
        args: [guildId],
      })
      .catch(console.error);
  }

  await db
    .execute({
      sql: `DELETE FROM guild_deletion_queue WHERE guild_id = ?`,
      args: [guildId],
    })
    .catch(console.error);

  console.log(`Purged all data for guild: ${guildId}`);
}

/**
 * 削除予約のうち、猶予期間を過ぎたguildを一括で完全削除する。
 * ready.js から起動時＋定期実行で呼ばれる。
 */
/**
 * Bot起動時、DB上に設定が残っているのに現在参加していないguildを
 * 削除予約に登録する（オフライン中に蹴られた/削除されたケースの救済）。
 * すでに予約済み・現在参加中のguildは対象外。
 */
export async function reconcileGuildDeletions(client) {
  const { rows } = await db
    .execute(`SELECT guild_id FROM settings`)
    .catch(() => ({ rows: [] }));

  const activeGuildIds = new Set(client.guilds.cache.keys());
  let scheduled = 0;

  for (const row of rows) {
    if (!activeGuildIds.has(row.guild_id)) {
      const { rows: existing } = await db
        .execute({
          sql: `SELECT 1 FROM guild_deletion_queue WHERE guild_id = ?`,
          args: [row.guild_id],
        })
        .catch(() => ({ rows: [] }));

      if (existing.length === 0) {
        await scheduleGuildDeletion(row.guild_id);
        scheduled++;
      }
    }
  }

  if (scheduled > 0) {
    console.log(`Reconciled ${scheduled} guild(s) not seen while offline; scheduled for deletion.`);
  }
}

export async function purgeExpiredGuilds() {
  const { rows } = await db
    .execute({
      sql: `SELECT guild_id FROM guild_deletion_queue WHERE scheduled_at <= ?`,
      args: [Date.now()],
    })
    .catch(() => ({ rows: [] }));

  for (const row of rows) {
    await purgeGuildData(row.guild_id);
  }

  if (rows.length > 0) {
    console.log(`Purged ${rows.length} expired guild(s) from deletion queue.`);
  }
}
