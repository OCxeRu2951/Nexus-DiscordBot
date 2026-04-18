import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("ユーザーをキックします")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("対象ユーザー").setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("理由").setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") ?? "なし";
    const member = await interaction.guild.members
      .fetch(target.id)
      .catch(() => null);

    if (!member)
      return interaction.editReply("対象ユーザーがサーバーにいません。");
    if (!member.kickable)
      return interaction.editReply(
        "このユーザーをキックする権限がありません。",
      );
    if (target.id === interaction.user.id)
      return interaction.editReply("自分自身をキックすることはできません。");

    await target
      .send({
        content: `**${interaction.guild.name}** からキックされました。\n理由: ${reason}`,
      })
      .catch(() => {});

    await member.kick(reason);
    await sendModLog(
      interaction.guild,
      "kick",
      target,
      interaction.user,
      reason,
    );
    await interaction.editReply(`<@${target.id}> をキックしました。`);
  },
};
