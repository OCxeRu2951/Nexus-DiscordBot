import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('サーバー情報を表示します'),

  async execute(interaction) {
    await interaction.deferReply();
    const guild = interaction.guild;
    await guild.fetch();

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setColor(0x57f287)
      .addFields(
        { name: 'サーバーID', value: guild.id, inline: true },
        { name: 'オーナー', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'メンバー数', value: `${guild.memberCount}人`, inline: true },
        { name: 'チャンネル数', value: `${guild.channels.cache.size}`, inline: true },
        { name: 'ロール数', value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Boostレベル', value: `Tier ${guild.premiumTier}`, inline: true },
        { name: '作成日', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
