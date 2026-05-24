import { SlashCommandBuilder } from "discord.js";
import { db } from "../utils/db.js";

export default {
  data: new SlashCommandBuilder()
    .setName("lang")
    .setDescription("Set the bot language / 言語を設定します")
    .addStringOption((opt) =>
      opt
        .setName("lang")
        .setDescription("Language / 言語")
        .setRequired(true)
        .addChoices(
          { name: "English", value: "en" },
          { name: "日本語", value: "ja" },
        ),
    ),

  async execute(interaction) {
    const lang = interaction.options.getString("lang");

    await db.execute({
      sql: `INSERT INTO guild_lang (guild_id, lang) VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET lang = ?`,
      args: [interaction.guildId, lang, lang],
    });

    const msg =
      lang === "ja"
        ? "言語を **日本語** に設定しました。"
        : "Language set to **English**.";

    await interaction.reply(msg);
  },
};
