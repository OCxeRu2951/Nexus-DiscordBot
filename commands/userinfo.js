import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('ユーザー情報を表示します')
    .addUserOption(opt =>
      opt.setName('user').setDescription('対象ユーザー（省略時は自分）').setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') ?? interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle(target.username)
      .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
      .setColor(0xfee75c)
      .addFields(
        { name: 'ユーザーID', value: target.id, inline: true },
        { name: 'アカウント作成日', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true },
      );

    if (member) {
      embed.addFields(
        { name: 'サーバー参加日', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`, inline: true },
        { name: 'ニックネーム', value: member.nickname ?? 'なし', inline: true },
        {
          name: `ロール (${member.roles.cache.size - 1})`,
          value: member.roles.cache
            .filter(r => r.id !== interaction.guild.id)
            .map(r => `<@&${r.id}>`)
            .join(' ') || 'なし',
        },
      );
    }

    embed.setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};
