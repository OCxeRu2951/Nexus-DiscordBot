import { db } from "./db.js";
import { AttachmentBuilder } from "discord.js";

export async function exportApplications(guildId) {
  const { rows } = await db
    .execute({
      sql: `SELECT * FROM applications WHERE guild_id = ? ORDER BY created_at DESC`,
      args: [guildId],
    })
    .catch(() => ({ rows: [] }));

  if (rows.length === 0) return null;

  const header =
    "ID,申請内容,コメント,申請者ID,申請者名,ステータス,申請日時,処理日時";
  const lines = rows.map((row) => {
    const createdAt = new Date(Number(row.created_at)).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
    });
    const resolvedAt = row.resolved_at
      ? new Date(Number(row.resolved_at)).toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
        })
      : "";
    return [
      row.id,
      `"${row.content}"`,
      `"${row.comment ?? ""}"`,
      row.user_id,
      `"${row.username}"`,
      row.status,
      createdAt,
      resolvedAt,
    ].join(",");
  });

  const csv = [header, ...lines].join("\n");
  const buffer = Buffer.from("\uFEFF" + csv, "utf-8"); // BOM付きでExcelで文字化けしない

  return new AttachmentBuilder(buffer, {
    name: `applications_${guildId}_${Date.now()}.csv`,
  });
}
