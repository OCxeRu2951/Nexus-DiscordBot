import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("メッセージを一括削除します")
    .addIntegerOption((opt) =>
      opt
        .setName("amount")
        .setDescription("取得するメッセージ数 (1〜100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("特定ユーザーのメッセージのみ削除（省略時は全員）")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger("amount");
    const targetUser = interaction.options.getUser("user");

    await interaction.deferReply({ ephemeral: true });

    const messages = await interaction.channel.messages.fetch({
      limit: amount,
    });

    const toDelete = targetUser
      ? messages.filter((m) => m.author.id === targetUser.id)
      : messages;

    // bulkDeleteは14日以内のみ対応
    const deleted = await interaction.channel
      .bulkDelete(toDelete, true)
      .catch((err) => {
        console.error(err);
        return null;
      });

    if (!deleted) return interaction.editReply("削除に失敗しました。");

    const msg = targetUser
      ? `${targetUser.username} のメッセージを ${deleted.size} 件削除しました。`
      : `${deleted.size} 件のメッセージを削除しました。`;

    await interaction.editReply(msg);
  },
};
