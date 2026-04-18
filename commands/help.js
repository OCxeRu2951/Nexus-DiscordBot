import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("コマンドの説明を表示します")
    .addStringOption(
      (opt) =>
        opt
          .setName("command")
          .setDescription("説明を表示するコマンド名を入力（補完されます）")
          .setRequired(false)
          .setAutocomplete(true),
    ),

  async execute(interaction) {
    const commandName = interaction.options.getString("command");
    const { commands } = interaction.client;

    // 特定のコマンドが指定された場合
    if (commandName) {
      const command = commands.get(commandName);

      if (!command) {
        return interaction.reply({
          content: "そのコマンドは見つかりませんでした。",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`/${command.data.name} コマンドの説明`)
        .setDescription(
          `**${command.data.description}**\n\n` +
            "使用方法:\n" +
            `\`/${command.data.name} ${command.data.options.map((o) => `${o.name}:<${o.name}>`).join(" ")}\`\n\n` +
            "オプション:\n" +
            (command.data.options
              .map((o) => `- \`${o.name}\`: ${o.description}`)
              .join("\n") || "なし"),
        )
        .setColor(0x5865f2)
        .setTimestamp();

      return await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    // コマンド指定がない場合（一覧表示）
    const categories = {
      全般: [
        "afk",
        "timer",
        "sethourly",
        "poll",
        "clear",
        "dice",
        "serverinfo",
        "userinfo",
      ],
      モデレーション: [
        "warn",
        "warnings",
        "clearwarn",
        "kick",
        "ban",
        "unban",
        "timeout",
        "untimeout",
        "slowmode",
        "lock",
        "role",
        "note",
        "modhistory",
        "setmod",
      ],
      申請システム: ["apply-config"], // メッセージコマンド(!apply等)は別途記載
    };

    const embed = new EmbedBuilder()
      .setTitle("利用可能なコマンド一覧")
      .setDescription("`/help command:<コマンド名>` で詳細を表示できます。")
      .setColor(0x5865f2)
      .setTimestamp();

    for (const [category, cmds] of Object.entries(categories)) {
      embed.addFields({
        name: category,
        value: cmds.map((c) => `\`/${c}\``).join(", ") || "設定なし",
      });
    }

    // メッセージコマンド(Prefix用)の追記
    embed.addFields({
      name: "申請システム (Prefix: !)",
      value: "`!apply`, `!revoke`",
    });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },

  // オートコンプリート機能を利用する場合
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const { commands } = interaction.client;
    const choices = Array.from(commands.keys());
    const filtered = choices
      .filter((choice) => choice.startsWith(focusedValue))
      .slice(0, 25);
    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice })),
    );
  },
};
