import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../utils/db.js";

export default {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("AFK管理")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("操作を選択")
        .setRequired(true)
        .addChoices(
          { name: "set — AFKを設定する", value: "set" },
          { name: "list — AFK中のユーザーを表示", value: "list" },
        ),
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("離席理由（actionがsetの場合に入力）")
        .setRequired(false),
    ),

  async execute(interaction) {
    const action = interaction.options.getString("action");

    if (action === "set") {
      const reason = interaction.options.getString("reason") ?? "離席中";

      await db.execute({
        sql: `INSERT OR REPLACE INTO afk (user_id, reason, since) VALUES (?, ?, ?)`,
        args: [interaction.user.id, reason, Date.now()],
      });

      await interaction.reply(
        `**${interaction.user.username}** をAFKに設定しました。\n理由: ${reason}`,
      );
    }

    if (action === "list") {
      await interaction.deferReply();

      const { rows } = await db.execute(`SELECT * FROM afk`);

      if (rows.length === 0) {
        return interaction.editReply("現在AFK中のユーザーはいません。");
      }

      const embed = new EmbedBuilder()
        .setTitle("AFK中のユーザー")
        .setColor(0x5865f2)
        .setTimestamp();

      embed.addFields(
        rows.map((row) => {
          const elapsed = Math.floor((Date.now() - Number(row.since)) / 60000);
          return {
            name: `<@${row.user_id}>`,
            value: `理由: ${row.reason}\n${elapsed}分前から`,
            inline: true,
          };
        }),
      );

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
