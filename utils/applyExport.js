import { db } from "./db.js";
import { AttachmentBuilder } from "discord.js";

// 申請内容・申請者名は利用者が自由に書けるため、CSV の区切りを壊さないよう " を二重にし、
// Excel 等で数式として実行されないよう = + - @ タブ 改行 で始まる値は先頭に ' を付ける
function csvField(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

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
      csvField(row.content),
      csvField(row.comment),
      row.user_id,
      csvField(row.username),
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
