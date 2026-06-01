import { SlashCommandBuilder } from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Set or list AFK status")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set AFK")
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List AFK users"),
    ),

  async execute(interaction, client, lang) {
    const sub = interaction.options.getSubcommand();

    if (sub === "set") {
      const reason = interaction.options.getString("reason") ?? t(lang, "commands.common.no_reason");

      await db.execute({
        sql:  `INSERT OR REPLACE INTO afk (user_id, guild_id, reason, since) VALUES (?, ?, ?, ?)`,
        args: [interaction.user.id, interaction.guildId, reason, Date.now()],
      });

      return interaction.reply(
        t(lang, "commands.afk.set", { username: interaction.user.username, reason }),
      );
    }

    if (sub === "list") {
      const { rows } = await db.execute({
        sql:  `SELECT * FROM afk WHERE guild_id = ?`,
        args: [interaction.guildId],
      });

      if (rows.length === 0) {
        return interaction.reply(t(lang, "commands.afk.list_empty"));
      }

      const lines = rows.map((r) => {
        const elapsed = Math.floor((Date.now() - Number(r.since)) / 60000);
        return `<@${r.user_id}> — ${r.reason} (${t(lang, "commands.afk.elapsed", { elapsed })})`;
      });

      return interaction.reply({
        embeds: [{
          title:       t(lang, "commands.afk.list_title"),
          description: lines.join("\n"),
          color:       0x5865f2,
        }],
      });
    }
  },
};
