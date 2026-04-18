import { SlashCommandBuilder } from "discord.js";
import { db } from "../utils/db.js";

// 実行中のタイマーを管理するMap { reminderId -> timeoutId }
const activeTimers = new Map();

export default {
  data: new SlashCommandBuilder()
    .setName("timer")
    .setDescription("タイマー管理。start: タイマー開始 / stop: タイマー停止")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("操作を選択")
        .setRequired(true)
        .addChoices(
          { name: "start", value: "start" },
          { name: "stop", value: "stop" },
        ),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("minutes")
        .setDescription("分数 (0〜180)（start のみ）")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(180),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("seconds")
        .setDescription("秒数 (0〜59)（start のみ）")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(59),
    )
    .addStringOption((opt) =>
      opt
        .setName("label")
        .setDescription("タイマーのラベル（start のみ）")
        .setRequired(false),
    ),

  async execute(interaction) {
    const action = interaction.options.getString("action");

    // ---- stop ----
    if (action === "stop") {
      // 自分のアクティブなタイマーを検索
      const { rows } = await db.execute({
        sql: `SELECT * FROM reminders WHERE user_id = ? AND channel_id = ? AND fire_at > ?`,
        args: [interaction.user.id, interaction.channelId, Date.now()],
      });

      if (rows.length === 0) {
        return interaction.reply({
          content: "アクティブなタイマーが見つかりません。",
          ephemeral: true,
        });
      }

      // 複数ある場合は一覧表示して選択させる
      if (rows.length === 1) {
        const row = rows[0];
        const timeoutId = activeTimers.get(Number(row.id));
        if (timeoutId) {
          clearTimeout(timeoutId);
          activeTimers.delete(Number(row.id));
        }
        await db.execute({
          sql: `DELETE FROM reminders WHERE id = ?`,
          args: [row.id],
        });
        return interaction.reply(`**${row.label}** のタイマーを停止しました。`);
      }

      // 複数ある場合は最新のものを停止
      const row = rows[rows.length - 1];
      const timeoutId = activeTimers.get(Number(row.id));
      if (timeoutId) {
        clearTimeout(timeoutId);
        activeTimers.delete(Number(row.id));
      }
      await db.execute({
        sql: `DELETE FROM reminders WHERE id = ?`,
        args: [row.id],
      });
      return interaction.reply(`**${row.label}** のタイマーを停止しました。`);
    }

    // ---- start ----
    const minutes = interaction.options.getInteger("minutes") ?? 0;
    const seconds = interaction.options.getInteger("seconds") ?? 0;
    const totalMs = (minutes * 60 + seconds) * 1000;

    if (totalMs <= 0) {
      return interaction.reply({
        content: "`minutes` か `seconds` を1以上指定してください。",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const label = interaction.options.getString("label") ?? "タイマー";
    const fireAt = Date.now() + totalMs;

    const result = await db.execute({
      sql: `INSERT INTO reminders (user_id, channel_id, label, fire_at) VALUES (?, ?, ?, ?)`,
      args: [interaction.user.id, interaction.channelId, label, fireAt],
    });
    const reminderId = Number(result.lastInsertRowid);

    // 表示用の時間文字列
    const timeStr =
      minutes > 0 && seconds > 0
        ? `${minutes}分${seconds}秒`
        : minutes > 0
          ? `${minutes}分`
          : `${seconds}秒`;

    await interaction.editReply(
      `**${label}** を ${timeStr} 後にお知らせします。`,
    );

    const timeoutId = setTimeout(async () => {
      await interaction.followUp(
        `${interaction.user} **${label}** の時間です！ (${timeStr}経過)`,
      );
      activeTimers.delete(reminderId);
      await db.execute({
        sql: `DELETE FROM reminders WHERE id = ?`,
        args: [reminderId],
      });
    }, totalMs);

    activeTimers.set(reminderId, timeoutId);
  },
};
