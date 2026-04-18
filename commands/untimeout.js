import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("ユーザーのタイムアウトを解除します")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("対象ユーザー").setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("理由").setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") ?? "なし";
    const member = await interaction.guild.members
      .fetch(target.id)
      .catch(() => null);

    if (!member)
      return interaction.editReply("対象ユーザーがサーバーにいません。");
    if (!member.isCommunicationDisabled())
      return interaction.editReply(
        "このユーザーはタイムアウトされていません。",
      );

    await member.timeout(null, reason);
    await sendModLog(
      interaction.guild,
      "untimeout",
      target,
      interaction.user,
      reason,
    );
    await interaction.editReply(
      `<@${target.id}> のタイムアウトを解除しました。`,
    );
  },
};
