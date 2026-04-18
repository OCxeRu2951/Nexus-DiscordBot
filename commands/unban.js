import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("ユーザーのBANを解除します")
    .addStringOption((opt) =>
      opt
        .setName("user_id")
        .setDescription("対象ユーザーのID")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("理由").setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.options.getString("user_id");
    const reason = interaction.options.getString("reason") ?? "なし";

    const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!ban)
      return interaction.editReply("指定されたユーザーはBANされていません。");

    await interaction.guild.members.unban(userId, reason);
    await sendModLog(
      interaction.guild,
      "unban",
      ban.user,
      interaction.user,
      reason,
    );
    await interaction.editReply(`<@${userId}> のBANを解除しました。`);
  },
};
