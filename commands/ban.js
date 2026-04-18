import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("ユーザーをBANします")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("対象ユーザー").setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("理由").setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("delete_days")
        .setDescription("削除するメッセージの日数（0〜7）")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") ?? "なし";
    const deleteDays = interaction.options.getInteger("delete_days") ?? 0;
    const member = await interaction.guild.members
      .fetch(target.id)
      .catch(() => null);

    if (target.id === interaction.user.id)
      return interaction.editReply("自分自身をBANすることはできません。");
    if (member && !member.bannable)
      return interaction.editReply("このユーザーをBANする権限がありません。");

    await target
      .send({
        content: `**${interaction.guild.name}** からBANされました。\n理由: ${reason}`,
      })
      .catch(() => {});

    await interaction.guild.members.ban(target.id, {
      reason,
      deleteMessageDays: deleteDays,
    });
    await sendModLog(
      interaction.guild,
      "ban",
      target,
      interaction.user,
      reason,
    );
    await interaction.editReply(`<@${target.id}> をBANしました。`);
  },
};
