import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../utils/db.js";

export default {
  data: new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("警告を削除します")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("操作を選択")
        .setRequired(true)
        .addChoices(
          { name: "id", value: "id" },
          { name: "all", value: "all" },
        ),
    )
    .addUserOption((opt) =>
      opt.setName("user").setDescription("対象ユーザー").setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("warn_id")
        .setDescription("削除する警告のID（action: id のみ）")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const action = interaction.options.getString("action");
    const target = interaction.options.getUser("user");
    const warnId = interaction.options.getInteger("warn_id");

    if (action === "id") {
      if (!warnId)
        return interaction.editReply("`warn_id` を指定してください。");

      const { rows } = await db.execute({
        sql: `SELECT * FROM warnings WHERE id = ? AND guild_id = ? AND user_id = ?`,
        args: [warnId, interaction.guildId, target.id],
      });

      if (rows.length === 0) {
        return interaction.editReply("指定された警告が見つかりません。");
      }

      await db.execute({
        sql: `DELETE FROM warnings WHERE id = ?`,
        args: [warnId],
      });

      return interaction.editReply(`警告ID \`${warnId}\` を削除しました。`);
    }

    if (action === "all") {
      const { rowsAffected } = await db.execute({
        sql: `DELETE FROM warnings WHERE guild_id = ? AND user_id = ?`,
        args: [interaction.guildId, target.id],
      });

      return interaction.editReply(
        `<@${target.id}> の警告を全て削除しました。（${rowsAffected}件）`,
      );
    }
  },
};
