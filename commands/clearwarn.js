import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Delete a warning")
    .addIntegerOption((opt) => opt.setName("id").setDescription("Warning ID").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client, lang) {
    const id = interaction.options.getInteger("id");
    const { rows } = await db.execute({ sql: `SELECT * FROM warnings WHERE id = ? AND guild_id = ?`, args: [id, interaction.guildId] });

    if (rows.length === 0) {
      return interaction.reply({ content: t(lang, "commands.note.not_found"), ephemeral: true });
    }

    await db.execute({ sql: `DELETE FROM warnings WHERE id = ?`, args: [id] });
    return interaction.reply({ content: t(lang, "commands.note.deleted", { id }), ephemeral: true });
  },
};
