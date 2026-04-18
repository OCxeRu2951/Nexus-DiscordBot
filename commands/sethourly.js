import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../utils/db.js";

export default {
  data: new SlashCommandBuilder()
    .setName("sethourly")
    .setDescription("時報の設定を管理します")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("操作を選択")
        .setRequired(true)
        .addChoices(
          { name: "set — 時報チャンネルを設定する", value: "set" },
          { name: "unset — 時報を解除する", value: "unset" },
        ),
    )
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("時報チャンネル（action: set のみ）")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const action = interaction.options.getString("action");

    if (action === "set") {
      const channel = interaction.options.getChannel("channel");
      if (!channel) {
        return interaction.reply({
          content: "`channel` を指定してください。",
          ephemeral: true,
        });
      }

      await db.execute({
        sql: `INSERT OR REPLACE INTO settings (guild_id, hourly_channel_id) VALUES (?, ?)`,
        args: [interaction.guild.id, channel.id],
      });

      await interaction.reply(`時報チャンネルを ${channel} に設定しました。`);
    }

    if (action === "unset") {
      await db.execute({
        sql: `UPDATE settings SET hourly_channel_id = NULL WHERE guild_id = ?`,
        args: [interaction.guild.id],
      });

      await interaction.reply("時報を解除しました。");
    }
  },
};
