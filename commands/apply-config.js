import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";
import { exportApplications } from "../utils/applyExport.js";

export default {
  data: new SlashCommandBuilder()
    .setName("apply-config")
    .setDescription("Configure the application system")
    .addStringOption((opt) =>
      opt.setName("mode").setDescription("Mode").setRequired(true)
        .addChoices(
          { name: "channel  — application channel",  value: "channel"  },
          { name: "operator — notification role",    value: "operator" },
          { name: "notify   — notification method",  value: "notify"   },
          { name: "admin    — admin channel",        value: "admin"    },
          { name: "view     — list applications",    value: "view"     },
          { name: "export   — export CSV",           value: "export"   },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client, lang) {
    const mode = interaction.options.getString("mode");

    if (mode === "channel") {
      const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("apply_config_channel")
          .setPlaceholder(lang === "ja" ? "申請チャンネルを選択" : "Select application channel")
          .addChannelTypes(ChannelType.GuildText),
      );
      return interaction.reply({
        content:    lang === "ja" ? "申請を受け付けるチャンネルを選択してください。" : "Select the channel for applications.",
        components: [row],
        ephemeral:  true,
      });
    }

    if (mode === "operator") {
      const row = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId("apply_config_operator")
          .setPlaceholder(lang === "ja" ? "通知ロールを選択" : "Select notification role"),
      );
      return interaction.reply({
        content:    lang === "ja" ? "申請通知を受け取るロールを選択してください。" : "Select the role to receive notifications.",
        components: [row],
        ephemeral:  true,
      });
    }

    if (mode === "notify") {
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("apply_config_notify")
          .setPlaceholder(lang === "ja" ? "通知方法を選択" : "Select notification method")
          .addOptions([
            { label: lang === "ja" ? "DMで通知"         : "Notify via DM",      value: "dm"      },
            { label: lang === "ja" ? "チャンネルに通知"  : "Notify to channel",  value: "channel" },
          ]),
      );
      return interaction.reply({
        content:    lang === "ja" ? "通知方法を選択してください。" : "Select a notification method.",
        components: [row],
        ephemeral:  true,
      });
    }

    if (mode === "admin") {
      const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("apply_config_admin")
          .setPlaceholder(lang === "ja" ? "管理者チャンネルを選択" : "Select admin channel")
          .addChannelTypes(ChannelType.GuildText),
      );
      return interaction.reply({
        content:    lang === "ja" ? "管理者チャンネルを選択してください。" : "Select the admin channel.",
        components: [row],
        ephemeral:  true,
      });
    }

    if (mode === "view") {
      const { rows } = await db.execute({
        sql:  `SELECT * FROM applications WHERE guild_id = ? ORDER BY created_at DESC LIMIT 10`,
        args: [interaction.guildId],
      });

      if (rows.length === 0) {
        return interaction.reply({
          content:   t(lang, "commands.apply.view_empty"),
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(t(lang, "commands.apply.view_title"))
        .setColor(0x5865f2)
        .setTimestamp();

      for (const row of rows) {
        const statusEmoji = { pending: "⏳", approved: "✅", rejected: "❌", revoked: "🚫" }[row.status] ?? "❓";
        embed.addFields({
          name:  `${statusEmoji} ${row.id}`,
          value: `<@${row.user_id}> — ${row.content.slice(0, 50)}`,
          inline: false,
        });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (mode === "export") {
      await interaction.deferReply({ ephemeral: true });
      const csv = await exportApplicationsCsv(interaction.guildId);
      const buf = Buffer.from(csv, "utf-8");
      return interaction.editReply({
        content: t(lang, "commands.apply.export_done"),
        files:   [{ attachment: buf, name: `applications_${interaction.guildId}.csv` }],
      });
    }
  },
};
