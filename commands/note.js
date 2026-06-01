import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("note")
    .setDescription("Manage notes for a user")
    .addSubcommand((sub) =>
      sub.setName("add").setDescription("Add a note")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
        .addStringOption((opt) => opt.setName("note").setDescription("Note content").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List notes")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub.setName("delete").setDescription("Delete a note")
        .addIntegerOption((opt) => opt.setName("id").setDescription("Note ID").setRequired(true)),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client, lang) {
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const target = interaction.options.getUser("user");
      const note   = interaction.options.getString("note");
      await db.execute({
        sql:  `INSERT INTO mod_notes (guild_id, user_id, moderator_id, note, created_at) VALUES (?, ?, ?, ?, ?)`,
        args: [interaction.guildId, target.id, interaction.user.id, note, Date.now()],
      });
      return interaction.reply({ content: t(lang, "commands.note.added", { userId: target.id }), ephemeral: true });
    }

    if (sub === "list") {
      const target  = interaction.options.getUser("user");
      const { rows } = await db.execute({
        sql:  `SELECT * FROM mod_notes WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC`,
        args: [interaction.guildId, target.id],
      });
      if (rows.length === 0) return interaction.reply({ content: t(lang, "commands.note.empty", { userId: target.id }), ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle(t(lang, "commands.note.title", { username: target.username }))
        .setColor(0x5865f2).setTimestamp();

      for (const row of rows.slice(0, 10)) {
        const date = new Date(Number(row.created_at)).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-US");
        embed.addFields({ name: `#${row.id} — ${date}`, value: t(lang, "commands.note.field", { note: row.note, moderator: row.moderator_id }), inline: false });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "delete") {
      const id = interaction.options.getInteger("id");
      const { rows } = await db.execute({ sql: `SELECT * FROM mod_notes WHERE id = ? AND guild_id = ?`, args: [id, interaction.guildId] });
      if (rows.length === 0) return interaction.reply({ content: t(lang, "commands.note.not_found"), ephemeral: true });
      await db.execute({ sql: `DELETE FROM mod_notes WHERE id = ?`, args: [id] });
      return interaction.reply({ content: t(lang, "commands.note.deleted", { id }), ephemeral: true });
    }
  },
};
