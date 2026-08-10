import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { getLang, setGuildLang, clearGuildLang, t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("lang")
    .setDescription("Set the server's default Bot language")
    .addStringOption((opt) =>
      opt
        .setName("language")
        .setDescription("Language")
        .setRequired(true)
        .addChoices(
          { name: "Auto", value: "auto" },
          { name: "日本語", value: "ja" },
          { name: "English", value: "en" },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, client, lang) {
    const choice = interaction.options.getString("language");

    // ---- Auto ----
    if (choice === "auto") {
      await clearGuildLang(interaction.guildId);

      // Auto解除後に改めて優先順位に沿って言語を解決し、その言語で応答する
      const resolved = await getLang(interaction);
      return interaction.reply(t(resolved, "commands.lang.set_auto"));
    }

    // ---- ja / en ----
    await setGuildLang(interaction.guildId, choice);

    return interaction.reply(
      t(choice, choice === "ja" ? "commands.lang.set_ja" : "commands.lang.set_en"),
    );
  },
};
