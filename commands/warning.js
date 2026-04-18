import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { db } from "../utils/db.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("ユーザーの警告履歴を表示します")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("対象ユーザー").setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user");

    const { rows } = await db.execute({
      sql: `SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY issued_at DESC`,
      args: [interaction.guildId, target.id],
    });

    const total = rows.reduce((sum, r) => sum + Number(r.points), 0);

    if (rows.length === 0) {
      return interaction.editReply(`<@${target.id}> の警告履歴はありません。`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚠️ ${target.username} の警告履歴`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setColor(0xfee75c)
      .setFooter({ text: `累計: ${total}pt / ${rows.length}件` })
      .setTimestamp();

    const fields = rows.slice(0, 10).map((row, i) => ({
      name: `#${i + 1} — ${new Date(Number(row.issued_at)).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
      value: `理由: ${row.reason}\nポイント: ${row.points}pt\n実行者: <@${row.moderator_id}>`,
    }));

    embed.addFields(fields);

    if (rows.length > 10) {
      embed.setDescription(`※ 最新10件を表示しています（全${rows.length}件）`);
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
