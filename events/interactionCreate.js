import { db } from "../utils/db.js";
import { getLang, t } from "../utils/i18n.js";
import { EmbedBuilder } from "discord.js";
import { handleTimerStopSelect } from "../commands/timer.js";
import { handlePollVote } from "../commands/poll.js";

export default {
  name: "interactionCreate",
  async execute(interaction, client) {
    const lang = await getLang(interaction.guildId);

    // ---- ボタン処理 ----
    if (interaction.isButton()) {
      const { customId } = interaction;

      // ---- 投票ボタン ----
      if (customId.startsWith("poll_vote_")) {
        return handlePollVote(interaction, lang);
      }

      // ---- 申請ID表示 ----
      if (customId.startsWith("show_id|")) {
        const [, userId, appId] = customId.split("|");

        if (interaction.user.id !== userId) {
          return interaction.reply({
            content: t(lang, "commands.apply.not_applicant"),
            ephemeral: true,
          });
        }

        const { rows } = await db.execute({
          sql: `SELECT id FROM applications WHERE id = ? AND user_id = ?`,
          args: [appId, userId],
        });

        if (rows.length === 0) {
          return interaction.reply({
            content: t(lang, "commands.apply.not_found"),
            ephemeral: true,
          });
        }

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(t(lang, "commands.apply.id_title"))
              .setColor(0x5865f2)
              .addFields({ name: "ID", value: `\`${appId}\`` })
              .setDescription(t(lang, "commands.apply.dm_id"))
              .setTimestamp(),
          ],
          ephemeral: true,
        });
      }

      // ---- 申請承認・拒否 ----
      if (
        customId.startsWith("apply_approve_") ||
        customId.startsWith("apply_reject_")
      ) {
        const isApprove = customId.startsWith("apply_approve_");
        const id = customId
          .replace("apply_approve_", "")
          .replace("apply_reject_", "");
        const status = isApprove ? "approved" : "rejected";

        const { rows } = await db.execute({
          sql: `SELECT * FROM applications WHERE id = ?`,
          args: [id],
        });

        if (rows.length === 0) {
          return interaction.reply({
            content: t(lang, "commands.apply.not_found"),
            ephemeral: true,
          });
        }

        const app = rows[0];
        if (app.status !== "pending") {
          return interaction.reply({
            content: t(lang, "commands.apply.already", { status: app.status }),
            ephemeral: true,
          });
        }

        await db.execute({
          sql: `UPDATE applications SET status = ?, resolved_at = ? WHERE id = ?`,
          args: [status, Date.now(), id],
        });

        // ボタンを無効化
        const disabledComponents = interaction.message.components.map(
          (row) => ({
            type: 1,
            components: row.components.map((btn) => ({
              ...btn.toJSON(),
              disabled: true,
            })),
          }),
        );
        await interaction
          .update({ components: disabledComponents })
          .catch(() => {});

        // 申請者にDM（申請者のギルド言語で送信）
        try {
          const appLang = await getLang(app.guild_id);
          const user = await client.users.fetch(app.user_id);
          await user.send({
            embeds: [
              new EmbedBuilder()
                .setTitle(
                  t(
                    appLang,
                    isApprove
                      ? "commands.apply.approved"
                      : "commands.apply.rejected",
                  ),
                )
                .setColor(isApprove ? 0x2ecc71 : 0xe74c3c)
                .addFields(
                  { name: "ID", value: `\`${id}\``, inline: true },
                  {
                    name: t(appLang, "commands.apply.field_content"),
                    value: app.content,
                    inline: true,
                  },
                  {
                    name: t(appLang, "commands.apply.field_comment"),
                    value: app.comment ?? t(appLang, "commands.apply.none"),
                  },
                )
                .setTimestamp(),
            ],
          });
        } catch (err) {
          console.error("Failed to DM applicant:", err);
        }

        return interaction.followUp({
          content: t(lang, "commands.apply.moderated", { id, status }),
          ephemeral: true,
        });
      }
    }

    // ---- チャンネルセレクトメニュー ----
    if (interaction.isChannelSelectMenu()) {
      const channelId = interaction.values[0];

      if (interaction.customId === "apply_config_channel") {
        await db.execute({
          sql: `INSERT OR REPLACE INTO apply_settings (guild_id, apply_channel_id) VALUES (?, ?)
                 ON CONFLICT(guild_id) DO UPDATE SET apply_channel_id = ?`,
          args: [interaction.guildId, channelId, channelId],
        });
        return interaction.update({
          content: t(lang, "commands.apply.config_channel_set", { channelId }),
          components: [],
          embeds: [],
        });
      }

      if (interaction.customId === "apply_config_admin") {
        await db.execute({
          sql: `INSERT INTO apply_settings (guild_id, admin_channel_id) VALUES (?, ?)
                 ON CONFLICT(guild_id) DO UPDATE SET admin_channel_id = ?`,
          args: [interaction.guildId, channelId, channelId],
        });
        return interaction.update({
          content: t(lang, "commands.apply.config_admin_set", { channelId }),
          components: [],
          embeds: [],
        });
      }
    }

    // ---- ロールセレクトメニュー ----
    if (interaction.isRoleSelectMenu()) {
      if (interaction.customId === "apply_config_operator") {
        const roleId = interaction.values[0];
        await db.execute({
          sql: `INSERT INTO apply_settings (guild_id, operator_role_id) VALUES (?, ?)
                 ON CONFLICT(guild_id) DO UPDATE SET operator_role_id = ?`,
          args: [interaction.guildId, roleId, roleId],
        });
        return interaction.update({
          content: t(lang, "commands.apply.config_role_set", { roleId }),
          components: [],
          embeds: [],
        });
      }
    }

    // ---- 文字列セレクトメニュー ----
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "timer_stop_select") {
        return handleTimerStopSelect(interaction, lang);
      }

      if (interaction.customId === "apply_config_notify") {
        const notifyType = interaction.values[0];

        if (notifyType === "channel") {
          const { ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType } =
            await import("discord.js");
          const row = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId("apply_config_notify_channel")
              .setPlaceholder(
                t(lang, "commands.apply.config_notify_placeholder"),
              )
              .addChannelTypes(ChannelType.GuildText),
          );
          return interaction.update({
            content: t(lang, "commands.apply.config_notify_channel_prompt"),
            components: [row],
            embeds: [],
          });
        }

        await db.execute({
          sql: `INSERT INTO apply_settings (guild_id, notify_type) VALUES (?, ?)
                 ON CONFLICT(guild_id) DO UPDATE SET notify_type = ?`,
          args: [interaction.guildId, notifyType, notifyType],
        });
        return interaction.update({
          content: t(lang, "commands.apply.config_notify_set", { notifyType }),
          components: [],
          embeds: [],
        });
      }

      if (interaction.customId === "apply_config_notify_channel") {
        const channelId = interaction.values[0];
        await db.execute({
          sql: `INSERT INTO apply_settings (guild_id, notify_type, notify_target) VALUES (?, 'channel', ?)
                 ON CONFLICT(guild_id) DO UPDATE SET notify_type = 'channel', notify_target = ?`,
          args: [interaction.guildId, channelId, channelId],
        });
        return interaction.update({
          content: t(lang, "commands.apply.config_channel_set", { channelId }),
          components: [],
          embeds: [],
        });
      }
    }

    // ---- スラッシュコマンド処理 ----
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client, lang);
    } catch (err) {
      console.error(err);
      const msg = {
        content: t(lang, "commands.common.error"),
        flags: 64,
      };
      try {
        if (interaction.deferred) await interaction.editReply(msg);
        else if (!interaction.replied) await interaction.reply(msg);
      } catch (e) {
        console.error("Failed to send error response:", e);
      }
    }
  },
};
