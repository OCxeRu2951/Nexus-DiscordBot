import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
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
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user");

    const { rows } = await db.execute({
      sql: `SELECT * FROM mod_logs WHERE guild_id = ? AND target_id = ? ORDER BY created_at DESC LIMIT 20`,
      args: [interaction.guildId, target.id],
    });

    if (rows.length === 0) {
      return interaction.editReply(
        t(lang, "commands.modhistory.empty", { userId: target.id }),
      );
    }

    const embed = new EmbedBuilder()
      .setTitle(
        t(lang, "commands.modhistory.title", { username: target.username }),
      )
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setColor(0x5865f2)
      .setFooter({ text: t(lang, "commands.modhistory.footer") })
      .setTimestamp();

    const locale = lang === "ja" ? "ja-JP" : "en-US";

    embed.addFields(
      rows.map((row) => ({
        name: `${t(lang, `commands.modhistory.action.${row.action}`) ?? row.action} — ${new Date(Number(row.created_at)).toLocaleString(locale, { timeZone: "Asia/Tokyo" })}`,
        value: t(lang, "commands.modhistory.field", {
          reason: row.reason ?? t(lang, "commands.common.none"),
          moderator: row.moderator_id,
        }),
      })),
    );

    await interaction.editReply({ embeds: [embed] });
  },
};
