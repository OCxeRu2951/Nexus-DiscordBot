import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from "discord.js";
import { t } from "../utils/i18n.js";
import { getExecutor } from "../utils/hierarchy.js";

export default {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set slowmode for a channel")
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((opt) => opt.setName("seconds").setDescription("Seconds (0=disable)").setRequired(true).setMinValue(0).setMaxValue(21600))
    .addChannelOption((opt) => opt.setName("channel").setDescription("Target channel").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction, client, lang) {
    const seconds = interaction.options.getInteger("seconds");
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;

    // コマンドを使える権限は実行したチャンネルで判定されるため、対象チャンネルでもチャンネル管理を持つか確認する
    const executor = await getExecutor(interaction);
    if (!executor || !channel.permissionsFor?.(executor)?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: t(lang, "commands.common.no_permission"), ephemeral: true });
    }

    await channel.setRateLimitPerUser(seconds);

    return interaction.reply(
      seconds === 0
        ? t(lang, "commands.slowmode.unset", { channelId: channel.id })
        : t(lang, "commands.slowmode.set",   { channelId: channel.id, seconds }),
    );
  },
};
