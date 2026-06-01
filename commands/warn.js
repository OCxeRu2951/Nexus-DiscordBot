import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issue a warning to a user")
    .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(true))
    .addIntegerOption((opt) => opt.setName("points").setDescription("Warning points").setRequired(false).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client, lang) {
    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const points = interaction.options.getInteger("points") ?? 1;

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: t(lang, "commands.warn.self"), ephemeral: true });
    }

    await db.execute({
      sql:  `INSERT INTO warnings (guild_id, user_id, moderator_id, reason, points, issued_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [interaction.guildId, target.id, interaction.user.id, reason, points, Date.now()],
    });

    const { rows } = await db.execute({
      sql:  `SELECT COALESCE(SUM(points), 0) as total FROM warnings WHERE guild_id = ? AND user_id = ?`,
      args: [interaction.guildId, target.id],
    });
    const total = Number(rows[0]?.total ?? 0);

    await interaction.reply(t(lang, "commands.warn.success", { userId: target.id, points, total }));
    await target.send(t(lang, "commands.warn.dm", { guild: interaction.guild.name, reason, points, total })).catch(() => {});
    await sendModLog(interaction.client, interaction.guildId, { action: "warn", target, moderator: interaction.user, reason, extra: `+${points}pt / Total: ${total}pt` });
  },
};
