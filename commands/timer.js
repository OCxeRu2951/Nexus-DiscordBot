import { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } from "discord.js";
import { db } from "../utils/db.js";
import { getLang, t } from "../utils/i18n.js";

const activeTimers = new Map();
const MAX_MS = 3 * 60 * 60 * 1000;

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
    .setDescription("Start or stop a timer")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("Action")
        .setRequired(true)
        .addChoices(
          { name: "start", value: "start" },
          { name: "stop",  value: "stop"  },
        ),
    )
    .addIntegerOption((opt) =>
      opt.setName("minutes").setDescription("Minutes (0-180)").setRequired(false).setMinValue(0).setMaxValue(180),
    )
    .addIntegerOption((opt) =>
      opt.setName("seconds").setDescription("Seconds (0-59)").setRequired(false).setMinValue(0).setMaxValue(59),
    )
    .addStringOption((opt) =>
      opt.setName("label").setDescription("Label").setRequired(false),
    ),

  async execute(interaction, client, lang) {
    const action = interaction.options.getString("action");

    if (action === "stop") {
      const { rows } = await db.execute({
        sql:  `SELECT * FROM reminders WHERE user_id = ? AND channel_id = ? AND fire_at > ? ORDER BY fire_at ASC`,
        args: [interaction.user.id, interaction.channelId, Date.now()],
      });

      if (rows.length === 0) {
        return interaction.reply({ content: t(lang, "commands.timer.no_active"), ephemeral: true });
      }

      if (rows.length === 1) return stopTimer(interaction, rows[0], lang);

      const options = rows.slice(0, 25).map((r) => {
        const remaining = Math.max(0, Math.floor((Number(r.fire_at) - Date.now()) / 1000));
        return {
          label:       r.label.slice(0, 100),
          description: `残り約 ${formatTime(remaining * 1000)}`,
          value:       String(r.id),
        };
      });

      const select = new StringSelectMenuBuilder()
        .setCustomId("timer_stop_select")
        .setPlaceholder(t(lang, "commands.timer.select_placeholder"))
        .addOptions(options);

      return interaction.reply({
        content:    t(lang, "commands.timer.select_prompt"),
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral:  true,
      });
    }

    // start
    const minutes = interaction.options.getInteger("minutes") ?? 0;
    const seconds = interaction.options.getInteger("seconds") ?? 0;
    const totalMs = (minutes * 60 + seconds) * 1000;

    if (totalMs <= 0) {
      return interaction.reply({ content: t(lang, "commands.timer.no_minutes"), ephemeral: true });
    }
    if (totalMs > MAX_MS) {
      return interaction.reply({
        content:   t(lang, "commands.timer.max_duration", { max: formatTime(MAX_MS) }),
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const label   = interaction.options.getString("label") ?? (lang === "ja" ? "タイマー" : "Timer");
    const fireAt  = Date.now() + totalMs;
    const timeStr = formatTime(totalMs);

    const result = await db.execute({
      sql:  `INSERT INTO reminders (user_id, channel_id, label, fire_at) VALUES (?, ?, ?, ?)`,
      args: [interaction.user.id, interaction.channelId, label, fireAt],
    });
    const reminderId = Number(result.lastInsertRowid);

    await interaction.editReply(t(lang, "commands.timer.start", { label, time: timeStr }));

    const timeoutId = setTimeout(async () => {
      await interaction
        .followUp(`${interaction.user} ` + t(lang, "commands.timer.fired", { label, time: timeStr }))
        .catch(() => {});
      activeTimers.delete(reminderId);
      await db.execute({ sql: `DELETE FROM reminders WHERE id = ?`, args: [reminderId] }).catch(() => {});
    }, totalMs);

    activeTimers.set(reminderId, timeoutId);
  },
};

async function stopTimer(interaction, row, lang) {
  const timeoutId = activeTimers.get(Number(row.id));
  if (timeoutId) {
    clearTimeout(timeoutId);
    activeTimers.delete(Number(row.id));
  }
  await db.execute({ sql: `DELETE FROM reminders WHERE id = ?`, args: [row.id] });
  return interaction.reply(t(lang, "commands.timer.stopped", { label: row.label }));
}

export async function handleTimerStopSelect(interaction, lang) {
  const resolvedLang = lang ?? await getLang(interaction.guildId);
  const reminderId   = Number(interaction.values[0]);

  const { rows } = await db.execute({
    sql:  `SELECT * FROM reminders WHERE id = ?`,
    args: [reminderId],
  });

  if (rows.length === 0) {
    return interaction.update({
      content:    t(resolvedLang, "commands.timer.not_found"),
      components: [],
    });
  }

  const timeoutId = activeTimers.get(reminderId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    activeTimers.delete(reminderId);
  }

  await db.execute({ sql: `DELETE FROM reminders WHERE id = ?`, args: [reminderId] });

  return interaction.update({
    content:    t(resolvedLang, "commands.timer.stopped", { label: rows[0].label }),
    components: [],
  });
}
