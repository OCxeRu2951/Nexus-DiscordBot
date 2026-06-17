import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";
import { sendModLog, checkWarnThreshold } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issue a warning to a user")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Target user").setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason").setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("points")
        .setDescription("Warning points (default: 1)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client, lang) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const points = interaction.options.getInteger("points") ?? 1;

    if (target.id === interaction.user.id) {
      return interaction.editReply(t(lang, "commands.warn.self"));
    }

    await db.execute({
      sql: `INSERT INTO warnings (guild_id, user_id, moderator_id, reason, points, issued_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        interaction.guildId,
        target.id,
        interaction.user.id,
        reason,
        points,
        Date.now(),
      ],
    });

    const { rows } = await db.execute({
      sql: `SELECT SUM(points) as total FROM warnings WHERE guild_id = ? AND user_id = ?`,
      args: [interaction.guildId, target.id],
    });
    const total = Number(rows[0]?.total ?? 0);

    await target
      .send({
        embeds: [
          new EmbedBuilder()
            .setTitle(t(lang, "commands.warn.dm_title"))
            .setColor(0xfee75c)
            .addFields(
              {
                name: t(lang, "commands.warn.dm_field_server"),
                value: interaction.guild.name,
                inline: true,
              },
              { name: t(lang, "commands.warn.dm_field_reason"), value: reason },
              {
                name: t(lang, "commands.warn.dm_field_points"),
                value: t(lang, "commands.warn.dm_points", { points, total }),
                inline: true,
              },
            )
            .setTimestamp(),
        ],
      })
      .catch(() => {});

    await sendModLog(
      interaction.guild,
      "warn",
      target,
      interaction.user,
      reason,
      { points },
    );
    await checkWarnThreshold(interaction.guild, target.id);

    await interaction.editReply(
      t(lang, "commands.warn.success", { userId: target.id, points, total }),
    );
  },
};
