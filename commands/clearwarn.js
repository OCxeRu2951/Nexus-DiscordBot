import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Delete a warning")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("Action")
        .setRequired(true)
        .addChoices(
          { name: "id — Delete a specific warning", value: "id" },
          { name: "all — Delete all warnings", value: "all" },
        ),
    )
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Target user").setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("warn_id")
        .setDescription("Warning ID to delete (action: id only)")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client, lang) {
    await interaction.deferReply({ ephemeral: true });

    const action = interaction.options.getString("action");
    const target = interaction.options.getUser("user");
    const warnId = interaction.options.getInteger("warn_id");

    if (action === "id") {
      if (!warnId) {
        return interaction.editReply(t(lang, "commands.clearwarn.no_id"));
      }

      const { rows } = await db.execute({
        sql: `SELECT * FROM warnings WHERE id = ? AND guild_id = ? AND user_id = ?`,
        args: [warnId, interaction.guildId, target.id],
      });

      if (rows.length === 0) {
        return interaction.editReply(t(lang, "commands.clearwarn.not_found"));
      }

      await db.execute({
        sql: `DELETE FROM warnings WHERE id = ?`,
        args: [warnId],
      });

      return interaction.editReply(
        t(lang, "commands.clearwarn.deleted_id", { id: warnId }),
      );
    }

    if (action === "all") {
      const { rowsAffected } = await db.execute({
        sql: `DELETE FROM warnings WHERE guild_id = ? AND user_id = ?`,
        args: [interaction.guildId, target.id],
      });

      return interaction.editReply(
        t(lang, "commands.clearwarn.deleted_all", {
          userId: target.id,
          count: rowsAffected,
        }),
      );
    }
  },
};
