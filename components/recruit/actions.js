/**
 * Recruit Actions（ダッシュボードからの操作依頼）
 * ------------------------------------------------------------
 * 責務: ダッシュボードが recruit_actions に書き込んだ依頼を定期的に取り出して実行する。
 *
 * ダッシュボード（Cloudflare）から直接Discordの投稿を書き換えると、
 * Bot側の締切タイマー・メンション通知・Embedの組み立てと二重管理になるため、
 * 実際の処理は必ずBotが既存の関数（closeRecruit / updateRecruitList）で行う。
 *
 *   action = "close"         募集を手動締切（ボタンで締め切ったときと同じ処理）
 *   action = "refresh_list"  更新リストを作り直す（設定変更時）
 *
 * 権限チェックはダッシュボード側（書き込み時）で行う。
 */
import { db } from "../../utils/db.js";
import { getRecruit, closeRecruit } from "./index.js";
import { updateRecruitList } from "./list.js";

export const ACTION_POLL_INTERVAL_MS = 5000;
const BATCH_SIZE           = 20;
const PROCESSED_RETENTION  = 24 * 60 * 60 * 1000;

let workerTimer = null;
let processing  = false;

async function runAction(client, row) {
  if (!client.guilds.cache.has(String(row.guild_id))) return "guild_unavailable";

  if (row.action === "close") {
    const recruit = await getRecruit(Number(row.recruit_id));
    if (!recruit || String(recruit.guild_id) !== String(row.guild_id)) return "not_found";
    const closed = await closeRecruit(client, Number(row.recruit_id), "manual");
    return closed ? "closed" : "already_closed";
  }

  if (row.action === "refresh_list") {
    return updateRecruitList(client, String(row.guild_id));
  }

  return "unknown_action";
}

/**
 * 未処理の依頼を古い順に実行する。
 * @returns {Promise<number>} 取り出した件数
 */
export async function processRecruitActions(client) {
  if (processing) return 0;
  processing = true;

  try {
    const { rows } = await db.execute({
      sql:  `SELECT * FROM recruit_actions WHERE processed_at IS NULL ORDER BY id ASC LIMIT ?`,
      args: [BATCH_SIZE],
    });

    for (const row of rows) {
      // 取り出し済みの印を先に付ける（処理中にもう一度拾わないように）
      const claim = await db.execute({
        sql:  `UPDATE recruit_actions SET processed_at = ? WHERE id = ? AND processed_at IS NULL`,
        args: [Date.now(), row.id],
      });
      if (claim.rowsAffected === 0) continue;

      let result;
      try {
        result = await runAction(client, row);
      } catch (err) {
        console.error(`[recruit-actions] action ${row.id} (${row.action}) failed:`, err);
        result = "error";
      }

      await db
        .execute({ sql: `UPDATE recruit_actions SET result = ? WHERE id = ?`, args: [result, row.id] })
        .catch(console.error);
    }

    return rows.length;
  } finally {
    processing = false;
  }
}

export function startRecruitActionWorker(client) {
  if (workerTimer) return;
  const tick = () =>
    processRecruitActions(client).catch((err) => console.error("[recruit-actions] poll failed:", err));
  workerTimer = setInterval(tick, ACTION_POLL_INTERVAL_MS);
  tick();
}

export async function purgeProcessedRecruitActions() {
  await db
    .execute({
      sql:  `DELETE FROM recruit_actions WHERE processed_at IS NOT NULL AND processed_at < ?`,
      args: [Date.now() - PROCESSED_RETENTION],
    })
    .catch(console.error);
}
