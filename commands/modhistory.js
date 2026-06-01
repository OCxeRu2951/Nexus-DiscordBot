import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("modhistory")
    .setDescription("View moderation history for a user")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Target user").setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client, lang) {
    const target = interaction.options.getUser("user");

    const { rows } = await db.execute({
      sql:  `SELECT * FROM mod_logs WHERE guild_id = ? AND target_id = ? ORDER BY created_at DESC LIMIT 20`,
      args: [interaction.guildId, target.id],
    });

    if (rows.length === 0) {
      return interaction.reply({
        content:   t(lang, "commands.modhistory.empty", { userId: target.id }),
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(t(lang, "commands.modhistory.title", { username: target.username }))
      .setColor(0xe74c3c)
      .setFooter({ text: `${rows.length} records` })
      .setTimestamp();

    for (const row of rows.slice(0, 10)) {
      const date = new Date(Number(row.created_at)).toLocaleDateString(
        lang === "ja" ? "ja-JP" : "en-US",
      );
      embed.addFields({
        name:  `${row.action} — ${date}`,
        value: `${t(lang, "commands.modhistory.field_reason")}: ${row.reason ?? t(lang, "commands.modhistory.none")}\n${t(lang, "commands.modhistory.field_moderator")}: <@${row.moderator_id}>`,
        inline: false,
      });
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
