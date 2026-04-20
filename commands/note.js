import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { db } from "../utils/db.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("note")
    .setDescription("ユーザーへのモデレーターノートを管理します")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("操作を選択")
        .setRequired(true)
        .addChoices(
          { name: "add", value: "add" },
          { name: "list", value: "list" },
          { name: "delete", value: "delete" },
        ),
    )
    .addUserOption((opt) =>
      opt.setName("user").setDescription("対象ユーザー").setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("content")
        .setDescription("ノートの内容（action: add のみ）")
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("note_id")
        .setDescription("削除するノートのID（action: delete のみ）")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const action = interaction.options.getString("action");
    const target = interaction.options.getUser("user");

    if (action === "add") {
      const content = interaction.options.getString("content");
      if (!content)
        return interaction.editReply("`content` を指定してください。");

      await db.execute({
        sql: `INSERT INTO mod_notes (guild_id, user_id, moderator_id, note, created_at) VALUES (?, ?, ?, ?, ?)`,
        args: [
          interaction.guildId,
          target.id,
          interaction.user.id,
          content,
          Date.now(),
        ],
      });

      await sendModLog(
        interaction.guild,
        "note",
        target,
        interaction.user,
        content,
      );
      return interaction.editReply(`<@${target.id}> にノートを追加しました。`);
    }

    if (action === "list") {
      const { rows } = await db.execute({
        sql: `SELECT * FROM mod_notes WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC`,
        args: [interaction.guildId, target.id],
      });

      if (rows.length === 0)
        return interaction.editReply(`<@${target.id}> のノートはありません。`);

      const embed = new EmbedBuilder()
        .setTitle(`📝 ${target.username} のノート`)
        .setColor(0x95a5a6)
        .setTimestamp();

      embed.addFields(
        rows.slice(0, 10).map((row, i) => ({
          name: `#${row.id} — ${new Date(Number(row.created_at)).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
          value: `${row.note}\n実行者: <@${row.moderator_id}>`,
        })),
      );

      return interaction.editReply({ embeds: [embed] });
    }

    if (action === "delete") {
      const noteId = interaction.options.getInteger("note_id");
      if (!noteId)
        return interaction.editReply("`note_id` を指定してください。");

      const { rows } = await db.execute({
        sql: `SELECT * FROM mod_notes WHERE id = ? AND guild_id = ?`,
        args: [noteId, interaction.guildId],
      });

      if (rows.length === 0)
        return interaction.editReply("指定されたノートが見つかりません。");

      await db.execute({
        sql: `DELETE FROM mod_notes WHERE id = ?`,
        args: [noteId],
      });
      return interaction.editReply(`ノートID \`${noteId}\` を削除しました。`);
    }
  },
};
