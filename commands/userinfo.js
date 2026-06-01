import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Display user information")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Target user").setRequired(false),
    ),

  async execute(interaction, client, lang) {
    const target = interaction.options.getUser("user") ?? interaction.user;
    const member = interaction.guild.members.cache.get(target.id);

    const embed = new EmbedBuilder()
      .setTitle(target.username)
      .setThumbnail(target.displayAvatarURL())
      .setColor(0x5865f2)
      .addFields(
        { name: "ID",                                        value: target.id,                                                      inline: true },
        { name: t(lang, "commands.userinfo.created"),        value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`,         inline: true },
      )
      .setTimestamp();

    if (member) {
      embed.addFields(
        { name: t(lang, "commands.userinfo.joined"),    value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`,               inline: true },
        { name: t(lang, "commands.userinfo.roles"),     value: `${member.roles.cache.size - 1}`,                                  inline: true },
        { name: t(lang, "commands.userinfo.nickname"),  value: member.nickname ?? t(lang, "commands.userinfo.none"),              inline: true },
      );
    }

    return interaction.reply({ embeds: [embed] });
  },
};
