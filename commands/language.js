import { SlashCommandBuilder } from "discord.js";
import { setUserLang, clearUserLang, resolveLang, t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("language")
    .setDescription("Set your personal Bot language")
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
    ),

  async execute(interaction, client, lang) {
    const choice = interaction.options.getString("language");

    // ---- Auto ----
    if (choice === "auto") {
      await clearUserLang(interaction.user.id);

      // ユーザー設定を消した状態で改めて優先順位に沿って解決する
      // （サーバー設定 → Discord locale → en）
      const resolved = await resolveLang({
        userId: null,
        guildId: interaction.guildId,
        locale: interaction.locale,
      });

      return interaction.reply({
        content: t(resolved, "commands.language.set_auto"),
        ephemeral: true,
      });
    }

    // ---- ja / en ----
    await setUserLang(interaction.user.id, choice);

    return interaction.reply({
      content: t(choice, choice === "ja" ? "commands.language.set_ja" : "commands.language.set_en"),
      ephemeral: true,
    });
  },
};
