import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View warning history")
    .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client, lang) {
    const target = interaction.options.getUser("user");
    const { rows } = await db.execute({
      sql:  `SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY issued_at DESC`,
      args: [interaction.guildId, target.id],
    });

    if (rows.length === 0) {
      return interaction.reply({ content: t(lang, "commands.warn.history_empty", { userId: target.id }), ephemeral: true });
    }

    const total = rows.reduce((s, r) => s + Number(r.points), 0);
    const embed = new EmbedBuilder()
      .setTitle(t(lang, "commands.warn.history_title", { username: target.username }))
      .setColor(0xf0b232)
      .setFooter({ text: t(lang, "commands.warn.history_footer", { total, count: rows.length }) })
      .setTimestamp();

    for (const row of rows.slice(0, 10)) {
      const date = new Date(Number(row.issued_at)).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-US");
      embed.addFields({ name: date, value: t(lang, "commands.warn.history_field", { reason: row.reason, points: row.points, moderator: row.moderator_id }), inline: false });
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
