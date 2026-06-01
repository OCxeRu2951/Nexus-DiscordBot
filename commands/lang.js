import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("lang")
    .setDescription("Set the Bot language")
    .addStringOption((opt) =>
      opt.setName("language").setDescription("Language").setRequired(true)
        .addChoices(
          { name: "日本語", value: "ja" },
          { name: "English", value: "en" },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, client, lang) {
    const newLang = interaction.options.getString("language");

    await db.execute({
      sql:  `INSERT INTO guild_lang (guild_id, lang) VALUES (?, ?)
             ON CONFLICT(guild_id) DO UPDATE SET lang = ?`,
      args: [interaction.guildId, newLang, newLang],
    });

    return interaction.reply(
      t(newLang, newLang === "ja" ? "commands.lang.set_ja" : "commands.lang.set_en"),
    );
  },
};
