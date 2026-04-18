import { EmbedBuilder } from "discord.js";
import { db } from "./db.js";

const ACTION_COLORS = {
  warn: 0xfee75c,
  timeout: 0xe67e22,
  untimeout: 0x2ecc71,
  kick: 0xe74c3c,
  ban: 0x992d22,
  unban: 0x2ecc71,
  lock: 0xe74c3c,
  unlock: 0x2ecc71,
  slowmode: 0x3498db,
  note: 0x95a5a6,
  role_add: 0x2ecc71,
  role_remove: 0xe74c3c,
};

const ACTION_LABELS = {
  warn: "⚠️ 警告",
  timeout: "🔇 タイムアウト",
  untimeout: "🔊 タイムアウト解除",
  kick: "👢 キック",
  ban: "🔨 BAN",
  unban: "✅ BAN解除",
  lock: "🔒 チャンネルロック",
  unlock: "🔓 チャンネルロック解除",
  slowmode: "🐢 低速モード",
  note: "📝 ノート",
  role_add: "➕ ロール付与",
  role_remove: "➖ ロール剥奪",
};

export async function sendModLog(
  guild,
  action,
  target,
  moderator,
  reason = "なし",
  extra = {},
) {
  // DBに記録
  await db
    .execute({
      sql: `INSERT INTO mod_logs (guild_id, action, target_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [guild.id, action, target.id, moderator.id, reason, Date.now()],
    })
    .catch(console.error);

  // ログチャンネルに送信
  const { rows } = await db
    .execute({
      sql: `SELECT log_channel_id FROM mod_settings WHERE guild_id = ?`,
      args: [guild.id],
    })
    .catch(() => ({ rows: [] }));

  if (!rows.length || !rows[0].log_channel_id) return;

  const channel = guild.channels.cache.get(rows[0].log_channel_id);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(ACTION_LABELS[action] ?? action)
    .setColor(ACTION_COLORS[action] ?? 0x5865f2)
    .addFields(
      { name: "対象", value: `<@${target.id}> (${target.id})`, inline: true },
      { name: "実行者", value: `<@${moderator.id}>`, inline: true },
      { name: "理由", value: reason },
    )
    .setTimestamp();

  if (extra.duration)
    embed.addFields({ name: "時間", value: extra.duration, inline: true });
  if (extra.points)
    embed.addFields({
      name: "ポイント",
      value: String(extra.points),
      inline: true,
    });
  if (extra.channel)
    embed.addFields({
      name: "チャンネル",
      value: `<#${extra.channel}>`,
      inline: true,
    });
  if (extra.role)
    embed.addFields({
      name: "ロール",
      value: `<@&${extra.role}>`,
      inline: true,
    });

  await channel.send({ embeds: [embed] }).catch(console.error);
}

export async function checkWarnThreshold(guild, userId) {
  const { rows: settingRows } = await db
    .execute({
      sql: `SELECT * FROM mod_settings WHERE guild_id = ?`,
      args: [guild.id],
    })
    .catch(() => ({ rows: [] }));

  const setting = settingRows[0];
  if (!setting) return;

  const { rows } = await db.execute({
    sql: `SELECT SUM(points) as total FROM warnings WHERE guild_id = ? AND user_id = ?`,
    args: [guild.id, userId],
  });

  const total = Number(rows[0]?.total ?? 0);
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  // BANしきい値
  if (setting.warn_threshold_ban && total >= setting.warn_threshold_ban) {
    await member
      .ban({ reason: `警告ポイント上限（${total}pt）に達したため自動BAN` })
      .catch(console.error);
    await sendModLog(
      guild,
      "ban",
      member.user,
      guild.members.me.user,
      `警告ポイント上限（${total}pt）による自動BAN`,
    );
    return;
  }

  // タイムアウトしきい値
  if (
    setting.warn_threshold_timeout &&
    total >= setting.warn_threshold_timeout
  ) {
    const durationMs = (setting.timeout_duration_min ?? 60) * 60 * 1000;
    await member
      .timeout(
        durationMs,
        `警告ポイント上限（${total}pt）に達したため自動タイムアウト`,
      )
      .catch(console.error);
    await sendModLog(
      guild,
      "timeout",
      member.user,
      guild.members.me.user,
      `警告ポイント上限（${total}pt）による自動タイムアウト`,
      { duration: `${setting.timeout_duration_min}分` },
    );
  }
}
