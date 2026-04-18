import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} from "discord.js";
import { db } from "../utils/db.js";
import { exportApplications } from "../utils/applyExport.js";

export default {
  data: new SlashCommandBuilder()
    .setName("apply-config")
    .setDescription("申請システムの設定を管理します")
    .addStringOption((opt) =>
      opt
        .setName("mode")
        .setDescription("操作を選択")
        .setRequired(true)
        .addChoices(
          { name: "channel — 申請チャンネルを設定", value: "channel" },
          { name: "operator — 通知ロールを設定", value: "operator" },
          { name: "notify — 通知方法を設定", value: "notify" },
          { name: "admin — 管理者チャンネルを設定", value: "admin" },
          { name: "view — 現在の設定を表示", value: "view" },
          { name: "export — 申請履歴をエクスポート", value: "export" },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const mode = interaction.options.getString("mode");

    // exportは管理者チャンネルのみ
    if (mode === "export") {
      const { rows } = await db
        .execute({
          sql: `SELECT admin_channel_id FROM apply_settings WHERE guild_id = ?`,
          args: [interaction.guildId],
        })
        .catch(() => ({ rows: [] }));

      const adminChannelId = rows[0]?.admin_channel_id;
      if (!adminChannelId || interaction.channelId !== adminChannelId) {
        return interaction.reply({
          content: "このコマンドは管理者チャンネルでのみ使用できます。",
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });
      const file = await exportApplications(interaction.guildId);
      if (!file) {
        return interaction.editReply("エクスポートするデータがありません。");
      }
      return interaction.editReply({
        content: "申請履歴をエクスポートしました。",
        files: [file],
      });
    }

    if (mode === "view") {
      const { rows } = await db
        .execute({
          sql: `SELECT * FROM apply_settings WHERE guild_id = ?`,
          args: [interaction.guildId],
        })
        .catch(() => ({ rows: [] }));

      const s = rows[0];
      const embed = new EmbedBuilder()
        .setTitle("⚙️ 申請システム設定")
        .setColor(0x5865f2)
        .addFields(
          {
            name: "申請チャンネル",
            value: s?.apply_channel_id ? `<#${s.apply_channel_id}>` : "未設定",
            inline: true,
          },
          {
            name: "通知ロール",
            value: s?.operator_role_id ? `<@&${s.operator_role_id}>` : "未設定",
            inline: true,
          },
          { name: "通知方法", value: s?.notify_type ?? "未設定", inline: true },
          {
            name: "通知先",
            value: s?.notify_target
              ? s.notify_type === "channel"
                ? `<#${s.notify_target}>`
                : s.notify_target
              : "未設定",
            inline: true,
          },
          {
            name: "管理者チャンネル",
            value: s?.admin_channel_id ? `<#${s.admin_channel_id}>` : "未設定",
            inline: true,
          },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (mode === "channel") {
      const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("apply_config_channel")
          .setPlaceholder("申請を受け付けるチャンネルを選択")
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.PublicThread,
            ChannelType.PrivateThread,
          ),
      );
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📋 申請チャンネル設定")
            .setDescription(
              "申請を受け付けるチャンネルまたはスレッドを選択してください。",
            )
            .setColor(0x5865f2),
        ],
        components: [row],
        ephemeral: true,
      });
    }

    if (mode === "operator") {
      const row = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId("apply_config_operator")
          .setPlaceholder("通知を受け取るロールを選択"),
      );
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("👤 通知ロール設定")
            .setDescription("申請通知を受け取るロールを選択してください。")
            .setColor(0x5865f2),
        ],
        components: [row],
        ephemeral: true,
      });
    }

    if (mode === "admin") {
      const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("apply_config_admin")
          .setPlaceholder("管理者チャンネルを選択")
          .addChannelTypes(ChannelType.GuildText),
      );
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔒 管理者チャンネル設定")
            .setDescription(
              "管理者用チャンネルを選択してください。申請履歴のエクスポートはこのチャンネルでのみ可能です。",
            )
            .setColor(0x5865f2),
        ],
        components: [row],
        ephemeral: true,
      });
    }

    if (mode === "notify") {
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("apply_config_notify")
          .setPlaceholder("通知方法を選択")
          .addOptions(
            {
              label: "DM通知",
              value: "dm",
              description: "通知ロールのメンバーにDMで通知",
            },
            {
              label: "チャンネル通知",
              value: "channel",
              description: "指定チャンネルに通知",
            },
          ),
      );
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔔 通知方法設定")
            .setDescription("通知方法を選択してください。")
            .setColor(0x5865f2),
        ],
        components: [row],
        ephemeral: true,
      });
    }
  },
};
