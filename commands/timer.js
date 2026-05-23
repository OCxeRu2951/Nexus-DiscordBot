import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { db } from "../utils/db.js";

const activeTimers = new Map();

// 最大タイマー時間（デフォルト3時間・変更可能）
const MAX_MS = 3 * 60 * 60 * 1000;

async function fireTimer(interaction, reminderId, label, totalMs) {
  const timeStr = formatTime(totalMs);
  const timeoutId = setTimeout(async () => {
    await interaction
      .followUp(
        `${interaction.user} **${label}** の時間です！ (${timeStr}経過)`,
      )
      .catch(() => {});
    activeTimers.delete(reminderId);
    await db
      .execute({
        sql: `DELETE FROM reminders WHERE id = ?`,
        args: [reminderId],
      })
      .catch(() => {});
  }, totalMs);

  activeTimers.set(reminderId, timeoutId);

  // 最大時間で自動停止（totalMsがMAX_MS未満の場合は不要）
  if (totalMs < MAX_MS) {
    // 通常タイマーはtotalMs後に自動終了するため追加処理不要
  } else {
    // MAX_MSを超えている場合（起動時に既に弾くが念のため）
    const safetyId = setTimeout(async () => {
      const existing = activeTimers.get(reminderId);
      if (existing) {
        clearTimeout(existing);
        activeTimers.delete(reminderId);
      }
      await db
        .execute({
          sql: `DELETE FROM reminders WHERE id = ?`,
          args: [reminderId],
        })
        .catch(() => {});
      await interaction
        .followUp(
          `**${label}** のタイマーが最大時間に達したため自動停止しました。`,
        )
        .catch(() => {});
    }, MAX_MS);
    // safetyIdで上書き
    activeTimers.set(reminderId, safetyId);
    clearTimeout(timeoutId);
  }
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0 && s > 0) return `${m}分${s}秒`;
  if (m > 0) return `${m}分`;
  return `${s}秒`;
}

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
      const { rows } = await db.execute({
        sql: `SELECT * FROM reminders WHERE user_id = ? AND channel_id = ? AND fire_at > ? ORDER BY fire_at ASC`,
        args: [interaction.user.id, interaction.channelId, Date.now()],
      });

      if (rows.length === 0) {
        return interaction.reply({
          content: "アクティブなタイマーが見つかりません。",
          ephemeral: true,
        });
      }

      // 1件のみ → 即停止
      if (rows.length === 1) {
        return stopTimer(interaction, rows[0]);
      }

      // 複数件 → セレクトメニューで選択
      const options = rows.slice(0, 25).map((r) => {
        const remaining = Math.max(
          0,
          Math.floor((Number(r.fire_at) - Date.now()) / 1000),
        );
        const remStr = formatTime(remaining * 1000);
        return {
          label: r.label.slice(0, 100),
          description: `残り約 ${remStr}`,
          value: String(r.id),
        };
      });

      const select = new StringSelectMenuBuilder()
        .setCustomId("timer_stop_select")
        .setPlaceholder("停止するタイマーを選択")
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(select);

      return interaction.reply({
        content: "停止するタイマーを選択してください。",
        components: [row],
        ephemeral: true,
      });
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

    if (totalMs > MAX_MS) {
      return interaction.reply({
        content: `タイマーは最大 ${formatTime(MAX_MS)} まで設定できます。`,
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

    const timeStr = formatTime(totalMs);
    await interaction.editReply(
      `**${label}** を ${timeStr} 後にお知らせします。`,
    );

    // タイマー発火
    const timeoutId = setTimeout(async () => {
      await interaction
        .followUp(
          `${interaction.user} **${label}** の時間です！ (${timeStr}経過)`,
        )
        .catch(() => {});
      activeTimers.delete(reminderId);
      await db
        .execute({
          sql: `DELETE FROM reminders WHERE id = ?`,
          args: [reminderId],
        })
        .catch(() => {});
    }, totalMs);

    activeTimers.set(reminderId, timeoutId);
  },
};

// ---- helper ----
async function stopTimer(interaction, row) {
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

// セレクトメニューのハンドラをexportして interactionCreate.js から呼べるようにする
export async function handleTimerStopSelect(interaction) {
  const reminderId = Number(interaction.values[0]);

  const { rows } = await db.execute({
    sql: `SELECT * FROM reminders WHERE id = ?`,
    args: [reminderId],
  });

  if (rows.length === 0) {
    return interaction.update({
      content: "タイマーが見つかりません（すでに終了した可能性があります）。",
      components: [],
    });
  }

  const timeoutId = activeTimers.get(reminderId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    activeTimers.delete(reminderId);
  }

  await db.execute({
    sql: `DELETE FROM reminders WHERE id = ?`,
    args: [reminderId],
  });

  return interaction.update({
    content: `**${rows[0].label}** のタイマーを停止しました。`,
    components: [],
  });
}
