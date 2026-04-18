import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("ユーザーをタイムアウトします")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("対象ユーザー").setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("minutes")
        .setDescription("タイムアウト時間（分）")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("理由").setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user");
    const minutes = interaction.options.getInteger("minutes");
    const reason = interaction.options.getString("reason") ?? "なし";
    const member = await interaction.guild.members
      .fetch(target.id)
      .catch(() => null);

    if (!member)
      return interaction.editReply("対象ユーザーがサーバーにいません。");
    if (!member.moderatable)
      return interaction.editReply(
        "このユーザーをタイムアウトする権限がありません。",
      );
    if (target.id === interaction.user.id)
      return interaction.editReply(
        "自分自身をタイムアウトすることはできません。",
      );

    const durationMs = minutes * 60 * 1000;
    await member.timeout(durationMs, reason);

    const durationStr =
      minutes >= 60
        ? `${Math.floor(minutes / 60)}時間${minutes % 60 > 0 ? `${minutes % 60}分` : ""}`
        : `${minutes}分`;

    await target
      .send({
        content: `**${interaction.guild.name}** でタイムアウトされました。\n時間: ${durationStr}\n理由: ${reason}`,
      })
      .catch(() => {});

    await sendModLog(
      interaction.guild,
      "timeout",
      target,
      interaction.user,
      reason,
      { duration: durationStr },
    );
    await interaction.editReply(
      `<@${target.id}> を ${durationStr} タイムアウトしました。`,
    );
  },
};
