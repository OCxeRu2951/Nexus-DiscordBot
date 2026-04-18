import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("コマンドの説明を表示します")
    .addStringOption((opt) =>
      opt
        .setName("command")
        .setDescription("説明を表示するコマンドを選択")
        .setRequired(false)
        .addChoices(
          { name: "afk", value: "afk" },
          { name: "timer", value: "timer" },
          { name: "sethourly", value: "sethourly" },
          { name: "poll", value: "poll" },
          { name: "clear", value: "clear" },
          { name: "dice", value: "dice" },
          { name: "serverinfo", value: "serverinfo" },
          { name: "userinfo", value: "userinfo" },
        ),
    ),

  async execute(interaction) {
    const command = interaction.options.getString("command");

    if (command === "afk") {
      const embed = new EmbedBuilder()
        .setTitle("/afk コマンドの説明")
        .setDescription(
          "**/afk** コマンドは、ユーザーがAFK（離席中）状態を管理するためのコマンドです。\n\n" +
            "使用方法:\n" +
            "`/afk action:<set|list> reason:<離席理由>`\n\n" +
            "オプション:\n" +
            "- `action`: 操作を選択します。`set`はAFKを設定し、`list`は現在AFK中のユーザーを表示します。\n" +
            "- `reason`: AFKの理由を入力します（`action`が`set`の場合に使用）。省略した場合は「離席中」となります。",
        )
        .setColor(0x5865f2)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (command === "dice") {
      const embed = new EmbedBuilder()
        .setTitle("/dice コマンドの説明")
        .setDescription(
          "**/dice** コマンドは、ダイスを振るためのコマンドです。\n\n" +
            "使用方法:\n" +
            "`/dice sides:<面数> count:<個数> set:<振る回数> modifier:<加減算> buff:<高い目への偏り> debuff:<低い目への偏り> show_odds:<確率情報を表示>`\n\n" +
            "オプション:\n" +
            "- `sides`: ダイスの面数を指定します（2〜100）。省略した場合は6になります。\n" +
            "- `count`: 振るダイスの個数を指定します（1〜10）。省略した場合は1になります。\n" +
            "- `set`: ダイスを振る回数を指定します（1〜10）。省略した場合は1になります。\n" +
            "- `modifier`: ダイスの結果に加減算する値を指定します。省略した場合は0になります。\n" +
            "- `buff`: 高い目への偏りを0〜100%で指定します。省略した場合は0%になります。\n" +
            "- `debuff`: 低い目への偏りを0〜100%で指定します。省略した場合は0%になります。\n" +
            "- `show_odds`: 確率情報を表示するかどうかを指定します（true/false）。省略した場合はfalseになります。",
        )
        .setColor(0x5865f2)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (command === "poll") {
      const embed = new EmbedBuilder()
        .setTitle("/poll コマンドの説明")
        .setDescription(
          "**/poll** コマンドは、投票を作成するためのコマンドです。\n\n" +
            "使用方法:\n" +
            "`/poll question:<質問> options:<選択肢>`\n\n" +
            "オプション:\n" +
            "- `question`: 投票の質問を指定します。\n" +
            "- `choices`: 投票の選択肢を指定します（カンマ区切り）。省略した場合は「はい」と「いいえ」になります。",
          "- `duration`: 投票の継続時間を分単位で指定します。省略した場合は無期限になります。\n" +
            "- `anonymous`: 投票を匿名にするかどうかを指定します（true/false）。省略した場合はfalseになります。\n" +
            "- `max_choices`: 投票で選択できる最大数を指定します。省略した場合は1になります。\n" +
            "- `required_role`: 投票に参加できるロールを指定します。省略した場合は全員が参加できます。\n" +
            "- `hide_results`: 投票終了時に結果を通知しないかどうかを指定します（true/false）。省略した場合はfalseになります。",
        )
        .setColor(0x5865f2)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (command === "serverinfo") {
      const embed = new EmbedBuilder()
        .setTitle("/serverinfo コマンドの説明")
        .setDescription(
          "**/serverinfo** コマンドは、サーバーの情報を表示するためのコマンドです。\n\n" +
            "使用方法:\n" +
            "`/serverinfo`",
        )
        .setColor(0x5865f2)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (command === "userinfo") {
      const embed = new EmbedBuilder()
        .setTitle("/userinfo コマンドの説明")
        .setDescription(
          "**/userinfo** コマンドは、ユーザーの情報を表示するためのコマンドです。\n\n" +
            "使用方法:\n" +
            "`/userinfo user:<ユーザー>`\n\n" +
            "オプション:\n" +
            "- `user`: 情報を表示するユーザーを指定します。省略した場合はコマンドを実行したユーザーになります。",
        )
        .setColor(0x5865f2)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (command === "clear") {
      const embed = new EmbedBuilder()
        .setTitle("/clear コマンドの説明")
        .setDescription(
          "**/clear** コマンドは、メッセージをクリアするためのコマンドです。\n\n" +
            "使用方法:\n" +
            "`/clear amount:<削除するメッセージの数>`\n\n" +
            "オプション:\n" +
            "- `amount`: 削除するメッセージの数を指定します（1〜100）。省略した場合は10になります。",
          "- `user`: 特定ユーザーのメッセージのみ削除する場合は、ユーザーを指定します。省略した場合は全員のメッセージが対象になります。",
        )
        .setColor(0x5865f2)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (command === "timer") {
      const embed = new EmbedBuilder()
        .setTitle("/timer コマンドの説明")
        .setDescription(
          "**/timer** コマンドは、タイマーを設定するためのコマンドです。\n\n" +
            "使用方法:\n" +
            "`/timer action:<start|stop> minutes:<分> seconds:<秒> label:<ラベル>`\n\n" +
            "オプション:\n" +
            "- `action`: 操作を選択します。`start`はタイマーを開始し、`stop`はタイマーを停止します。\n" +
            "- `minutes`: タイマーの分数を指定します（`action`が`start`の場合に使用）。省略した場合は0になります。\n" +
            "- `seconds`: タイマーの秒数を指定します（`action`が`start`の場合に使用）。省略した場合は0になります。\n" +
            "- `label`: タイマーのラベルを指定します（`action`が`start`の場合に使用）。省略した場合は「タイマー」となります。",
        )
        .setColor(0x5865f2)
        .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } else if (command === "sethourly") {
      const embed = new EmbedBuilder()
        .setTitle("/sethourly コマンドの説明")
        .setDescription(
          "**/sethourly** コマンドは、時報の設定を管理するためのコマンドです。\n\n" +
            "使用方法:\n" +
            "`/sethourly action:<set|unset> channel:<チャンネル>`\n\n" +
            "オプション:\n" +
            "- `action`: 操作を選択します。`set`は時報チャンネルを設定し、`unset`は時報を解除します。\n" +
            "- `channel`: 時報チャンネルを指定します（`action`が`set`の場合に使用）。省略した場合は現在の設定が表示されます。",
        )
        .setColor(0x5865f2)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setTitle("利用可能なコマンド")
        .setDescription(
          "以下のコマンドが利用可能です:\n" +
            "- `/afk`: AFK管理\n" +
            "- `/timer`: タイマーを設定\n" +
            "- `/sethourly`: 時報の設定\n" +
            "- `/poll`: 投票を作成\n" +
            "- `/clear`: メッセージをクリア\n" +
            "- `/dice`: ダイスを振る\n" +
            "- `/serverinfo`: サーバー情報を表示\n" +
            "- `/userinfo`: ユーザー情報を表示\n\n" +
            "各コマンドの詳細な説明を知りたい場合は、`/help command:<コマンド名>` を使用してください。",
        )
        .setColor(0x5865f2)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  },
};
