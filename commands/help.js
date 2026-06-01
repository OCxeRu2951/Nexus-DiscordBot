import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { t } from "../utils/i18n.js";

const CATEGORIES = {
  category_general: [
    "afk", "timer", "sethourly", "poll", "clear",
    "dice", "serverinfo", "userinfo",
  ],
  category_mod: [
    "warn", "warnings", "clearwarn", "kick", "ban", "unban",
    "timeout", "untimeout", "slowmode", "lock", "role",
    "note", "modhistory", "setmod",
  ],
  category_apply: ["apply-config"],
};

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Display command information")
    .addStringOption((opt) =>
      opt
        .setName("command")
        .setDescription("Command name to display details")
        .setRequired(false)
        .setAutocomplete(true),
    ),

  async execute(interaction, client, lang) {
    const commandName = interaction.options.getString("command");
    const { commands } = interaction.client;

    // 特定コマンドの詳細表示
    if (commandName) {
      const command = commands.get(commandName);

      if (!command) {
        return interaction.reply({
          content:   t(lang, "commands.help.not_found"),
          ephemeral: true,
        });
      }

      const options    = command.data.options ?? [];
      const usageArgs  = options.map((o) => `${o.name}:<${o.name}>`).join(" ");
      const optionList = options.length > 0
        ? options.map((o) => `- \`${o.name}\`: ${o.description}`).join("\n")
        : t(lang, "commands.help.options_none");

      const embed = new EmbedBuilder()
        .setTitle(t(lang, "commands.help.command_title", { name: command.data.name }))
        .setDescription(
          `**${command.data.description}**\n\n` +
          `**${t(lang, "commands.help.usage")}**\n` +
          `\`/${command.data.name}${usageArgs ? " " + usageArgs : ""}\`\n\n` +
          `**${t(lang, "commands.help.options")}**\n` +
          optionList,
        )
        .setColor(0x5865f2)
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // コマンド一覧表示
    const embed = new EmbedBuilder()
      .setTitle(t(lang, "commands.help.list_title"))
      .setDescription(t(lang, "commands.help.list_desc"))
      .setColor(0x5865f2)
      .setTimestamp();

    for (const [categoryKey, cmds] of Object.entries(CATEGORIES)) {
      embed.addFields({
        name:  t(lang, `commands.help.${categoryKey}`),
        value: cmds.map((c) => `\`/${c}\``).join(", ") || t(lang, "commands.help.options_none"),
      });
    }

    embed.addFields({
      name:  t(lang, "commands.help.category_prefix"),
      value: t(lang, "commands.help.prefix_commands"),
    });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const choices      = Array.from(interaction.client.commands.keys());
    const filtered     = choices
      .filter((c) => c.startsWith(focusedValue))
      .slice(0, 25);

    await interaction.respond(
      filtered.map((c) => ({ name: c, value: c })),
    );
  },
};
