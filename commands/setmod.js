import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("setmod")
    .setDescription("Manage moderation settings")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("Action")
        .setRequired(true)
        .addChoices(
          { name: "log — Set log channel", value: "log" },
          { name: "threshold — Set thresholds", value: "threshold" },
          { name: "view — View current settings", value: "view" },
        ),
    )
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Log channel (action: log only)")
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("timeout_at")
        .setDescription("Points to trigger timeout (action: threshold only)")
        .setRequired(false)
        .setMinValue(1),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("ban_at")
        .setDescription("Points to trigger ban (action: threshold only)")
        .setRequired(false)
        .setMinValue(1),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("timeout_min")
        .setDescription("Timeout duration in minutes (action: threshold only)")
        .setRequired(false)
        .setMinValue(1),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client, lang) {
    await interaction.deferReply({ ephemeral: true });

    const action = interaction.options.getString("action");

    if (action === "log") {
      const channel = interaction.options.getChannel("channel");
      if (!channel) {
        return interaction.editReply(t(lang, "commands.setmod.no_channel"));
      }

      await db.execute({
        sql: `INSERT INTO mod_settings (guild_id, log_channel_id) VALUES (?, ?)
               ON CONFLICT(guild_id) DO UPDATE SET log_channel_id = ?`,
        args: [interaction.guildId, channel.id, channel.id],
      });

      return interaction.editReply(
        t(lang, "commands.setmod.log_set", { channelId: channel.id }),
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

      if (updates.length === 0) {
        return interaction.editReply(t(lang, "commands.setmod.no_value"));
      }

      await db.execute({
        sql: `INSERT INTO mod_settings (guild_id) VALUES (?)
               ON CONFLICT(guild_id) DO UPDATE SET ${updates.join(", ")}`,
        args: [interaction.guildId, ...args],
      });

      return interaction.editReply(
        t(lang, "commands.setmod.threshold_updated"),
      );
    }

    if (action === "view") {
      const { rows } = await db
        .execute({
          sql: `SELECT * FROM mod_settings WHERE guild_id = ?`,
          args: [interaction.guildId],
        })
        .catch(() => ({ rows: [] }));

      const s = rows[0];
      const unset = t(lang, "commands.setmod.unset");
      const def = t(lang, "commands.setmod.timeout_default");

      const embed = new EmbedBuilder()
        .setTitle(t(lang, "commands.setmod.view_title"))
        .setColor(0x5865f2)
        .addFields(
          {
            name: t(lang, "commands.setmod.field_log"),
            value: s?.log_channel_id ? `<#${s.log_channel_id}>` : unset,
            inline: true,
          },
          {
            name: t(lang, "commands.setmod.field_timeout_at"),
            value: s?.warn_threshold_timeout
              ? `${s.warn_threshold_timeout}pt`
              : unset,
            inline: true,
          },
          {
            name: t(lang, "commands.setmod.field_ban_at"),
            value: s?.warn_threshold_ban ? `${s.warn_threshold_ban}pt` : unset,
            inline: true,
          },
          {
            name: t(lang, "commands.setmod.field_timeout_min"),
            value: s?.timeout_duration_min
              ? `${s.timeout_duration_min}${t(lang, "commands.setmod.min")}`
              : def,
            inline: true,
          },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
