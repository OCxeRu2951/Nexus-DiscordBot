import { db } from "../utils/db.js";
import { EmbedBuilder } from "discord.js";

export default {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (interaction.isButton()) {
      const { customId } = interaction;

      if (customId.startsWith("show_id_")) {
        console.log("--- Button Interaction Debug ---");
        console.log(`[1] Raw CustomID: ${customId}`);

        try {
          // インタラクション失敗を避けるため即座に defer
          await interaction.deferReply({ ephemeral: true });
          console.log("[2] Interaction deferred successfully.");

          const parts = customId.split("_");
          console.log(`[3] Split Parts:`, parts);

          // 送信側が show_id_userId_appId の形式であることを想定
          const userId = parts[2];
          const appId = parts[3];

          console.log(`[4] Parsed Data: UserID=${userId}, AppID=${appId}`);
          console.log(`[5] Clicking User: ${interaction.user.id}`);

          if (interaction.user.id !== userId) {
            console.log("[!] Security Check: User ID mismatch.");
            return await interaction.editReply({
              content: "⚠️ 自分の申請IDのみ確認できます。",
            });
          }

          // DB検索の直前にログ
          console.log(`[6] Executing DB Query for AppID: ${appId}`);
          const { rows } = await db.execute({
            sql: `SELECT id, status FROM applications WHERE id = ? AND user_id = ?`,
            args: [appId, userId],
          });

          console.log(`[7] DB Result:`, rows);

          if (rows.length === 0) {
            console.log("[!] DB Check: No matching application found.");
            return await interaction.editReply({
              content:
                "申請データが見つかりませんでした。期限切れか、すでに削除された可能性があります。",
            });
          }

          console.log("[8] Success: Sending ID to user.");
          return await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle("📋 申請IDの再確認")
                .setDescription(`あなたの申請IDは \`${appId}\` です。`)
                .setColor(0x5865f2),
            ],
          });
        } catch (error) {
          console.error("--- Critical Interaction Error ---");
          console.error(error);

          if (interaction.deferred) {
            await interaction.editReply({
              content: "処理中にエラーが発生しました。ログを確認してください。",
            });
          }
        }
        console.log("--- End Debug ---");
      }

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
            content: "申請が見つかりません。",
            ephemeral: true,
          });
        }

        const app = rows[0];
        if (app.status !== "pending") {
          return interaction.reply({
            content: `この申請はすでに **${app.status}** です。`,
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

        // 申請者にDM（client.usersから直接fetch）
        try {
          const user = await client.users.fetch(app.user_id);
          await user.send({
            embeds: [
              new EmbedBuilder()
                .setTitle(
                  isApprove
                    ? "✅ 申請が承認されました"
                    : "❌ 申請が拒否されました",
                )
                .setColor(isApprove ? 0x2ecc71 : 0xe74c3c)
                .addFields(
                  { name: "ID", value: `\`${id}\``, inline: true },
                  { name: "申請内容", value: app.content, inline: true },
                  { name: "コメント", value: app.comment ?? "なし" },
                )
                .setTimestamp(),
            ],
          });
        } catch (err) {
          console.error("Failed to DM applicant:", err);
        }

        return interaction.followUp({
          content: `申請 \`${id}\` を **${status}** にしました。`,
          ephemeral: true,
        });
      }
    }

    // ---- セレクトメニュー処理 ----
    if (interaction.isChannelSelectMenu()) {
      const channelId = interaction.values[0];

      if (interaction.customId === "apply_config_channel") {
        await db.execute({
          sql: `INSERT OR REPLACE INTO apply_settings (guild_id, apply_channel_id) VALUES (?, ?)
                ON CONFLICT(guild_id) DO UPDATE SET apply_channel_id = ?`,
          args: [interaction.guildId, channelId, channelId],
        });
        return interaction.update({
          content: `申請チャンネルを <#${channelId}> に設定しました。`,
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
          content: `管理者チャンネルを <#${channelId}> に設定しました。`,
          components: [],
          embeds: [],
        });
      }
    }

    if (interaction.isRoleSelectMenu()) {
      if (interaction.customId === "apply_config_operator") {
        const roleId = interaction.values[0];
        await db.execute({
          sql: `INSERT INTO apply_settings (guild_id, operator_role_id) VALUES (?, ?)
                ON CONFLICT(guild_id) DO UPDATE SET operator_role_id = ?`,
          args: [interaction.guildId, roleId, roleId],
        });
        return interaction.update({
          content: `通知ロールを <@&${roleId}> に設定しました。`,
          components: [],
          embeds: [],
        });
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "apply_config_notify") {
        const notifyType = interaction.values[0];

        if (notifyType === "channel") {
          const { ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType } =
            await import("discord.js");
          const row = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId("apply_config_notify_channel")
              .setPlaceholder("通知チャンネルを選択")
              .addChannelTypes(ChannelType.GuildText),
          );
          return interaction.update({
            content: "通知チャンネルを選択してください。",
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
          content: `通知方法を **${notifyType}** に設定しました。`,
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
          content: `通知チャンネルを <#${channelId}> に設定しました。`,
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
      await command.execute(interaction, client);
    } catch (err) {
      console.error(err);
      const msg = {
        content: "コマンドの実行中にエラーが発生しました。",
        flags: 64,
      };
      try {
        if (interaction.deferred) {
          await interaction.editReply(msg);
        } else if (!interaction.replied) {
          await interaction.reply(msg);
        }
      } catch (e) {
        console.error("Failed to send error response:", e);
      }
    }
  },
};
