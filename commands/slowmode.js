import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set slowmode for a channel")
    .addIntegerOption((opt) => opt.setName("seconds").setDescription("Seconds (0=disable)").setRequired(true).setMinValue(0).setMaxValue(21600))
    .addChannelOption((opt) => opt.setName("channel").setDescription("Target channel").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction, client, lang) {
    const seconds = interaction.options.getInteger("seconds");
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;

    await channel.setRateLimitPerUser(seconds);

    return interaction.reply(
      seconds === 0
        ? t(lang, "commands.slowmode.unset", { channelId: channel.id })
        : t(lang, "commands.slowmode.set",   { channelId: channel.id, seconds }),
    );
  },
};
