import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import { db } from "../utils/db.js";

export default {
  data: new SlashCommandBuilder()
    .setName("setmod")
    .setDescription("モデレーション設定を管理します")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("操作を選択")
        .setRequired(true)
        .addChoices(
          { name: "log — ログチャンネルを設定", value: "log" },
          { name: "threshold — 警告しきい値を設定", value: "threshold" },
          { name: "view — 現在の設定を表示", value: "view" },
        ),
    )
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("ログチャンネル（action: log のみ）")
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("timeout_at")
        .setDescription("タイムアウトするポイント数（action: threshold のみ）")
        .setRequired(false)
        .setMinValue(1),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("ban_at")
        .setDescription("BANするポイント数（action: threshold のみ）")
        .setRequired(false)
        .setMinValue(1),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("timeout_min")
        .setDescription(
          "自動タイムアウトの時間（分）（action: threshold のみ）",
        )
        .setRequired(false)
        .setMinValue(1),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const action = interaction.options.getString("action");

    if (action === "log") {
      const channel = interaction.options.getChannel("channel");
      if (!channel)
        return interaction.editReply("`channel` を指定してください。");

      await db.execute({
        sql: `INSERT INTO mod_settings (guild_id, log_channel_id) VALUES (?, ?)
              ON CONFLICT(guild_id) DO UPDATE SET log_channel_id = ?`,
        args: [interaction.guildId, channel.id, channel.id],
      });

      return interaction.editReply(
        `ログチャンネルを <#${channel.id}> に設定しました。`,
      );
    }

    if (action === "threshold") {
      const timeoutAt = interaction.options.getInteger("timeout_at");
      const banAt = interaction.options.getInteger("ban_at");
      const timeoutMin = interaction.options.getInteger("timeout_min");

      const updates = [];
      const args = [];

      if (timeoutAt !== null) {
        updates.push("warn_threshold_timeout = ?");
        args.push(timeoutAt);
      }
      if (banAt !== null) {
        updates.push("warn_threshold_ban = ?");
        args.push(banAt);
      }
      if (timeoutMin !== null) {
        updates.push("timeout_duration_min = ?");
        args.push(timeoutMin);
      }

      if (updates.length === 0)
        return interaction.editReply("設定する値を指定してください。");

      args.push(interaction.guildId);
      await db.execute({
        sql: `INSERT INTO mod_settings (guild_id) VALUES (?)
              ON CONFLICT(guild_id) DO UPDATE SET ${updates.join(", ")}`,
        args: [interaction.guildId, ...args],
      });

      return interaction.editReply("しきい値を更新しました。");
    }

    if (action === "view") {
      const { rows } = await db
        .execute({
          sql: `SELECT * FROM mod_settings WHERE guild_id = ?`,
          args: [interaction.guildId],
        })
        .catch(() => ({ rows: [] }));

      const s = rows[0];
      const embed = new EmbedBuilder()
        .setTitle("⚙️ モデレーション設定")
        .setColor(0x5865f2)
        .addFields(
          {
            name: "ログチャンネル",
            value: s?.log_channel_id ? `<#${s.log_channel_id}>` : "未設定",
            inline: true,
          },
          {
            name: "タイムアウトしきい値",
            value: s?.warn_threshold_timeout
              ? `${s.warn_threshold_timeout}pt`
              : "未設定",
            inline: true,
          },
          {
            name: "BANしきい値",
            value: s?.warn_threshold_ban
              ? `${s.warn_threshold_ban}pt`
              : "未設定",
            inline: true,
          },
          {
            name: "自動タイムアウト時間",
            value: s?.timeout_duration_min
              ? `${s.timeout_duration_min}分`
              : "60分（デフォルト）",
            inline: true,
          },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
