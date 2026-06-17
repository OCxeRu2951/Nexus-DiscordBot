import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View warning history for a user")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Target user").setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client, lang) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user");

    const { rows } = await db.execute({
      sql: `SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY issued_at DESC`,
      args: [interaction.guildId, target.id],
    });

    const total = rows.reduce((sum, r) => sum + Number(r.points), 0);

    if (rows.length === 0) {
      return interaction.editReply(
        t(lang, "commands.warn.history_empty", { userId: target.id }),
      );
    }

    const embed = new EmbedBuilder()
      .setTitle(
        t(lang, "commands.warn.history_title", { username: target.username }),
      )
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setColor(0xfee75c)
      .setFooter({
        text: t(lang, "commands.warn.history_footer", {
          total,
          count: rows.length,
        }),
      })
      .setTimestamp();

    const locale = lang === "ja" ? "ja-JP" : "en-US";

    const fields = rows.slice(0, 10).map((row, i) => ({
      name: `#${i + 1} — ${new Date(Number(row.issued_at)).toLocaleString(locale, { timeZone: "Asia/Tokyo" })}`,
      value: t(lang, "commands.warn.history_field", {
        reason: row.reason,
        points: row.points,
        moderator: row.moderator_id,
      }),
    }));

    embed.addFields(fields);

    if (rows.length > 10) {
      embed.setDescription(
        t(lang, "commands.warn.history_more", { count: rows.length }),
      );
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
