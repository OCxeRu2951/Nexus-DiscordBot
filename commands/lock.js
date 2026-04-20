import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
} from "discord.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("チャンネルをロック・解除します")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("操作を選択")
        .setRequired(true)
        .addChoices(
          { name: "lock", value: "lock" },
          { name: "unlock", value: "unlock" },
        ),
    )
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("対象チャンネル（省略時は現在のチャンネル）")
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("理由").setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const action = interaction.options.getString("action");
    const channel =
      interaction.options.getChannel("channel") ?? interaction.channel;
    const reason = interaction.options.getString("reason") ?? "なし";
    const everyone = interaction.guild.roles.everyone;

    if (action === "lock") {
      await channel.permissionOverwrites.edit(everyone, {
        SendMessages: false,
      });
      await channel
        .send("🔒 このチャンネルはロックされました。")
        .catch(() => {});
      await sendModLog(
        interaction.guild,
        "lock",
        { id: channel.id },
        interaction.user,
        reason,
        { channel: channel.id },
      );
      await interaction.editReply(`<#${channel.id}> をロックしました。`);
    }

    if (action === "unlock") {
      await channel.permissionOverwrites.edit(everyone, {
        SendMessages: null,
      });
      await channel
        .send("🔓 このチャンネルのロックを解除しました。")
        .catch(() => {});
      await sendModLog(
        interaction.guild,
        "unlock",
        { id: channel.id },
        interaction.user,
        reason,
        { channel: channel.id },
      );
      await interaction.editReply(`<#${channel.id}> のロックを解除しました。`);
    }
  },
};
