import { db } from "../utils/db.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

function generateId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `APL-${dateStr}-${rand}`;
}

export default {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;

    // ---- AFK検知 ----
    const { rows: selfRows } = await db.execute({
      sql: `SELECT user_id FROM afk WHERE user_id = ?`,
      args: [message.author.id],
    });
    if (selfRows.length > 0) {
      await db.execute({
        sql: `DELETE FROM afk WHERE user_id = ?`,
        args: [message.author.id],
      });
      await message.reply("AFKを解除しました。").catch(console.error);
    }

    for (const user of message.mentions.users.values()) {
      const { rows } = await db.execute({
        sql: `SELECT reason, since FROM afk WHERE user_id = ?`,
        args: [user.id],
      });
      if (rows.length > 0) {
        const { reason, since } = rows[0];
        const elapsed = Math.floor((Date.now() - Number(since)) / 60000);
        await message
          .reply(
            `**${user.username}** は現在AFK中です（${elapsed}分前）\n理由: ${reason}`,
          )
          .catch(console.error);
      }
    }

    // ---- プレフィクスコマンド ----
    const content = message.content.trim();

    // !apply
    if (content.startsWith("!apply ")) {
      const args = content.slice(7).trim();
      if (!args) {
        return message.reply("使い方: `!apply <申請内容> <コメント>`");
      }

      // 申請チャンネルチェック
      const { rows: settings } = await db
        .execute({
          sql: `SELECT * FROM apply_settings WHERE guild_id = ?`,
          args: [message.guildId],
        })
        .catch(() => ({ rows: [] }));

      const setting = settings[0];
      if (
        !setting?.apply_channel_id ||
        message.channelId !== setting.apply_channel_id
      ) {
        return message
          .reply({
            content: "申請はこのチャンネルでは行えません。",
          })
          .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 5000));
      }

      const [content_, ...commentParts] = args.split(" ");
      const comment = commentParts.join(" ") || null;
      const id = generateId();
      const now = Date.now();

      await db.execute({
        sql: `INSERT INTO applications (id, guild_id, channel_id, user_id, username, content, comment, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        args: [
          id,
          message.guildId,
          message.channelId,
          message.author.id,
          message.author.username,
          content_,
          comment,
          now,
        ],
      });

      // 申請者にDMでID通知
      const dmResult = await message.author
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle("✅ 申請を受け付けました")
              .setColor(0x2ecc71)
              .addFields(
                { name: "ID", value: `\`${id}\``, inline: true },
                { name: "申請内容", value: content_, inline: true },
                { name: "コメント", value: comment ?? "なし" },
              )
              .setDescription(
                "このIDは取り消し時に必要です。大切に保管してください。",
              )
              .setTimestamp(),
          ],
        })
        .catch((err) => {
          console.error("Failed to DM applicant:", err.message);
          return null;
        });

      if (!dmResult) {
        await message.reply({
          content:
            "⚠️ 申請を受け付けましたが、DMを送信できませんでした。下のボタンを押してIDを確認し、必ず控えてください。",
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`show_id|${message.author.id}|${id}`)
                .setLabel("IDを表示")
                .setStyle(ButtonStyle.Primary),
            ),
          ],
        });
      } else {
        await message.reply("✅ 申請を受け付けました。IDをDMで送信しました。");
      }

      // 管理者/ロールへの通知
      const applyEmbed = new EmbedBuilder()
        .setTitle("📩 新規申請")
        .setColor(0x5865f2)
        .addFields(
          { name: "ID", value: `\`${id}\``, inline: true },
          { name: "ステータス", value: "pending", inline: true },
          { name: "申請内容", value: content_, inline: true },
          { name: "コメント", value: comment ?? "なし" },
          { name: "申請者", value: `<@${message.author.id}>`, inline: true },
          { name: "サーバー", value: message.guild.name, inline: true },
          {
            name: "チャンネル",
            value: `<#${message.channelId}>`,
            inline: true,
          },
        )
        .setTimestamp();

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`apply_approve_${id}`)
          .setLabel("✅ 承認")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`apply_reject_${id}`)
          .setLabel("❌ 拒否")
          .setStyle(ButtonStyle.Danger),
      );

      // DM通知
      if (setting.notify_type === "dm" && setting.operator_role_id) {
        const role = message.guild.roles.cache.get(setting.operator_role_id);
        if (role) {
          for (const [, member] of role.members) {
            await member
              .send({ embeds: [applyEmbed], components: [buttons] })
              .catch(() => {});
          }
        }
      }

      // チャンネル通知
      const sentChannels = new Set();

      if (setting.notify_type === "channel" && setting.notify_target) {
        const ch = message.guild.channels.cache.get(setting.notify_target);
        if (ch) {
          await ch
            .send({ embeds: [applyEmbed], components: [buttons] })
            .catch(console.error);
          sentChannels.add(setting.notify_target);
        }
      }

      // 管理者チャンネルにも送信
      if (
        setting.admin_channel_id &&
        !sentChannels.has(setting.admin_channel_id)
      ) {
        const adminCh = message.guild.channels.cache.get(
          setting.admin_channel_id,
        );
        if (adminCh)
          await adminCh
            .send({ embeds: [applyEmbed], components: [buttons] })
            .catch(console.error);
      }
    }

    // !revoke
    if (content.startsWith("!revoke ")) {
      const id = content.slice(8).trim();
      if (!id) return message.reply("使い方: `!revoke <ID>`");

      const { rows } = await db.execute({
        sql: `SELECT * FROM applications WHERE id = ?`,
        args: [id],
      });

      if (rows.length === 0) {
        return message.reply("指定されたIDの申請が見つかりません。");
      }

      const app = rows[0];
      if (app.status !== "pending") {
        return message.reply(
          `この申請はすでに **${app.status}** です。取り消しできません。`,
        );
      }

      await db.execute({
        sql: `UPDATE applications SET status = 'revoked', resolved_at = ? WHERE id = ?`,
        args: [Date.now(), id],
      });

      await message.reply(`申請 \`${id}\` を取り消しました。`);

      // 管理者への通知
      const { rows: settings } = await db
        .execute({
          sql: `SELECT * FROM apply_settings WHERE guild_id = ?`,
          args: [message.guildId],
        })
        .catch(() => ({ rows: [] }));

      const setting = settings[0];
      const revokeEmbed = new EmbedBuilder()
        .setTitle("🚫 申請取り消し")
        .setColor(0xe74c3c)
        .addFields(
          { name: "ID", value: `\`${id}\``, inline: true },
          { name: "申請内容", value: app.content, inline: true },
          { name: "コメント", value: app.comment ?? "なし" },
          {
            name: "取り消し者",
            value: `<@${message.author.id}>`,
            inline: true,
          },
        )
        .setTimestamp();

      const revokeNotifiedChannels = new Set();

      if (setting?.notify_type === "channel" && setting?.notify_target) {
        const ch = message.guild.channels.cache.get(setting.notify_target);
        if (ch) {
          await ch.send({ embeds: [revokeEmbed] }).catch(console.error);
          revokeNotifiedChannels.add(setting.notify_target);
        }
      }

      if (
        setting?.admin_channel_id &&
        !revokeNotifiedChannels.has(setting.admin_channel_id)
      ) {
        const adminCh = message.guild.channels.cache.get(
          setting.admin_channel_id,
        );
        if (adminCh)
          await adminCh.send({ embeds: [revokeEmbed] }).catch(console.error);
      }

      if (setting?.notify_type === "dm" && setting?.operator_role_id) {
        const role = message.guild.roles.cache.get(setting.operator_role_id);
        if (role) {
          for (const [, member] of role.members) {
            await member.send({ embeds: [revokeEmbed] }).catch(() => {});
          }
        }
      }
    }
  },
};
