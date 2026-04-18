import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("チャンネルの低速モードを設定します")
    .addIntegerOption((opt) =>
      opt
        .setName("seconds")
        .setDescription("秒数（0で解除）")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600),
    )
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("対象チャンネル（省略時は現在のチャンネル）")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const seconds = interaction.options.getInteger("seconds");
    const channel =
      interaction.options.getChannel("channel") ?? interaction.channel;

    await channel.setRateLimitPerUser(
      seconds,
      `低速モード設定 by ${interaction.user.username}`,
    );

    const msg =
      seconds === 0
        ? `<#${channel.id}> の低速モードを解除しました。`
        : `<#${channel.id}> の低速モードを ${seconds}秒 に設定しました。`;

    await sendModLog(
      interaction.guild,
      "slowmode",
      { id: channel.id },
      interaction.user,
      `${seconds}秒`,
      { channel: channel.id },
    );
    await interaction.editReply(msg);
  },
};
