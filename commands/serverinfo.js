import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Display server information"),

  async execute(interaction, client, lang) {
    const guild = interaction.guild;
    await guild.fetch();

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL())
      .setColor(0x5865f2)
      .addFields(
        { name: t(lang, "commands.serverinfo.owner"),    value: `<@${guild.ownerId}>`,                                              inline: true },
        { name: t(lang, "commands.serverinfo.members"),  value: `${guild.memberCount}`,                                            inline: true },
        { name: t(lang, "commands.serverinfo.channels"), value: `${guild.channels.cache.size}`,                                    inline: true },
        { name: t(lang, "commands.serverinfo.roles"),    value: `${guild.roles.cache.size}`,                                       inline: true },
        { name: t(lang, "commands.serverinfo.boost"),    value: `Level ${guild.premiumTier}`,                                      inline: true },
        { name: t(lang, "commands.serverinfo.created"),  value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,              inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
