import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { db } from "../utils/db.js";
import { sendModLog, checkWarnThreshold } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("ユーザーに警告を発行します")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("対象ユーザー").setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("理由").setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("points")
        .setDescription("警告ポイント（デフォルト: 1）")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const points = interaction.options.getInteger("points") ?? 1;

    if (target.id === interaction.user.id) {
      return interaction.editReply(
        "自分自身に警告を発行することはできません。",
      );
    }

    await db.execute({
      sql: `INSERT INTO warnings (guild_id, user_id, moderator_id, reason, points, issued_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        interaction.guildId,
        target.id,
        interaction.user.id,
        reason,
        points,
        Date.now(),
      ],
    });

    // 累計ポイントを取得
    const { rows } = await db.execute({
      sql: `SELECT SUM(points) as total FROM warnings WHERE guild_id = ? AND user_id = ?`,
      args: [interaction.guildId, target.id],
    });
    const total = Number(rows[0]?.total ?? 0);

    // 対象ユーザーにDM通知
    await target
      .send({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚠️ 警告を受けました")
            .setColor(0xfee75c)
            .addFields(
              { name: "サーバー", value: interaction.guild.name, inline: true },
              { name: "理由", value: reason },
              {
                name: "ポイント",
                value: `+${points}pt（累計: ${total}pt）`,
                inline: true,
              },
            )
            .setTimestamp(),
        ],
      })
      .catch(() => {});

    await sendModLog(
      interaction.guild,
      "warn",
      target,
      interaction.user,
      reason,
      { points },
    );
    await checkWarnThreshold(interaction.guild, target.id);

    await interaction.editReply(
      `<@${target.id}> に警告を発行しました。（+${points}pt / 累計: ${total}pt）`,
    );
  },
};
