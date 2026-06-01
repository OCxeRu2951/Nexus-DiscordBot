import { db } from "../utils/db.js";
import { getLang, t } from "../utils/i18n.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

function generateId() {
  const date    = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rand    = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `APL-${dateStr}-${rand}`;
}

export default {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;

    const lang = await getLang(message.guildId);

    // ---- AFK検知 ----
    const { rows: selfRows } = await db.execute({
      sql:  `SELECT user_id FROM afk WHERE user_id = ?`,
      args: [message.author.id],
    });
    if (selfRows.length > 0) {
      await db.execute({ sql: `DELETE FROM afk WHERE user_id = ?`, args: [message.author.id] });
      await message.reply(t(lang, "commands.afk.unset")).catch(console.error);
    }

    for (const user of message.mentions.users.values()) {
      const { rows } = await db.execute({
        sql:  `SELECT reason, since FROM afk WHERE user_id = ?`,
        args: [user.id],
      });
      if (rows.length > 0) {
        const { reason, since } = rows[0];
        const elapsed = Math.floor((Date.now() - Number(since)) / 60000);
        await message
          .reply(t(lang, "commands.afk.mention", { username: user.username, elapsed, reason }))
          .catch(console.error);
      }
    }

    // ---- プレフィクスコマンド ----
    const content = message.content.trim();

    // !apply
    if (content.startsWith("!apply ")) {
      const args = content.slice(7).trim();
      if (!args) return message.reply(t(lang, "commands.apply.usage"));

      const { rows: settings } = await db
        .execute({ sql: `SELECT * FROM apply_settings WHERE guild_id = ?`, args: [message.guildId] })
        .catch(() => ({ rows: [] }));

      const setting = settings[0];
      if (!setting?.apply_channel_id || message.channelId !== setting.apply_channel_id) {
        return message
          .reply({ content: t(lang, "commands.apply.wrong_channel") })
          .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 5000));
      }

      const [content_, ...commentParts] = args.split(" ");
      const comment = commentParts.join(" ") || null;
      const id  = generateId();
      const now = Date.now();

      await db.execute({
        sql:  `INSERT INTO applications (id, guild_id, channel_id, user_id, username, content, comment, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        args: [id, message.guildId, message.channelId, message.author.id, message.author.username, content_, comment, now],
      });

      // 申請者にDMでID通知
      const dmResult = await message.author
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle(t(lang, "commands.apply.dm_title"))
              .setColor(0x2ecc71)
              .addFields(
                { name: "ID",                                              value: `\`${id}\``,                                         inline: true },
                { name: t(lang, "commands.apply.field_content"),           value: content_,                                            inline: true },
                { name: t(lang, "commands.apply.field_comment"),           value: comment ?? t(lang, "commands.apply.none") },
              )
              .setDescription(t(lang, "commands.apply.dm_id"))
              .setTimestamp(),
          ],
        })
        .catch((err) => { console.error("Failed to DM applicant:", err.message); return null; });

      if (!dmResult) {
        await message.reply({
          content: t(lang, "commands.apply.accepted_no_dm"),
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`show_id|${message.author.id}|${id}`)
                .setLabel(t(lang, "commands.apply.show_id_btn"))
                .setStyle(ButtonStyle.Primary),
            ),
          ],
        });
      } else {
        await message.reply(t(lang, "commands.apply.accepted"));
      }

      // 管理者/ロールへの通知
      const applyEmbed = new EmbedBuilder()
        .setTitle(t(lang, "commands.apply.new_title"))
        .setColor(0x5865f2)
        .addFields(
          { name: "ID",                                              value: `\`${id}\``,                    inline: true },
          { name: t(lang, "commands.apply.field_status"),           value: "pending",                       inline: true },
          { name: t(lang, "commands.apply.field_content"),          value: content_,                        inline: true },
          { name: t(lang, "commands.apply.field_comment"),          value: comment ?? t(lang, "commands.apply.none") },
          { name: t(lang, "commands.apply.field_applicant"),        value: `<@${message.author.id}>`,       inline: true },
          { name: t(lang, "commands.apply.field_server"),           value: message.guild.name,              inline: true },
          { name: t(lang, "commands.apply.field_channel"),          value: `<#${message.channelId}>`,       inline: true },
        )
        .setTimestamp();

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`apply_approve_${id}`)
          .setLabel(t(lang, "commands.apply.approve_btn"))
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`apply_reject_${id}`)
          .setLabel(t(lang, "commands.apply.reject_btn"))
          .setStyle(ButtonStyle.Danger),
      );

      const sentChannels = new Set();

      if (setting.notify_type === "dm" && setting.operator_role_id) {
        const role = message.guild.roles.cache.get(setting.operator_role_id);
        if (role) {
          for (const [, member] of role.members) {
            await member.send({ embeds: [applyEmbed], components: [buttons] }).catch(() => {});
          }
        }
      }

      if (setting.notify_type === "channel" && setting.notify_target) {
        const ch = message.guild.channels.cache.get(setting.notify_target);
        if (ch) {
          await ch.send({ embeds: [applyEmbed], components: [buttons] }).catch(console.error);
          sentChannels.add(setting.notify_target);
        }
      }

      if (setting.admin_channel_id && !sentChannels.has(setting.admin_channel_id)) {
        const adminCh = message.guild.channels.cache.get(setting.admin_channel_id);
        if (adminCh) await adminCh.send({ embeds: [applyEmbed], components: [buttons] }).catch(console.error);
      }
    }

    // !revoke
    if (content.startsWith("!revoke ")) {
      const id = content.slice(8).trim();
      if (!id) return message.reply(t(lang, "commands.apply.revoke_usage"));

      const { rows } = await db.execute({ sql: `SELECT * FROM applications WHERE id = ?`, args: [id] });
      if (rows.length === 0) return message.reply(t(lang, "commands.apply.not_found"));

      const app = rows[0];
      if (app.status !== "pending") return message.reply(t(lang, "commands.apply.already", { status: app.status }));

      await db.execute({ sql: `UPDATE applications SET status = 'revoked', resolved_at = ? WHERE id = ?`, args: [Date.now(), id] });
      await message.reply(t(lang, "commands.apply.revoked", { id }));

      const { rows: settings } = await db
        .execute({ sql: `SELECT * FROM apply_settings WHERE guild_id = ?`, args: [message.guildId] })
        .catch(() => ({ rows: [] }));

      const setting = settings[0];

      const revokeEmbed = new EmbedBuilder()
        .setTitle(t(lang, "commands.apply.cancel_title"))
        .setColor(0xe74c3c)
        .addFields(
          { name: "ID",                                              value: `\`${id}\``,                         inline: true },
          { name: t(lang, "commands.apply.field_content"),          value: app.content,                         inline: true },
          { name: t(lang, "commands.apply.field_comment"),          value: app.comment ?? t(lang, "commands.apply.none") },
          { name: t(lang, "commands.apply.field_cancelled_by"),     value: `<@${message.author.id}>`,           inline: true },
        )
        .setTimestamp();

      const revokeNotifiedChannels = new Set();

      if (setting?.notify_type === "channel" && setting?.notify_target) {
        const ch = message.guild.channels.cache.get(setting.notify_target);
        if (ch) { await ch.send({ embeds: [revokeEmbed] }).catch(console.error); revokeNotifiedChannels.add(setting.notify_target); }
      }

      if (setting?.admin_channel_id && !revokeNotifiedChannels.has(setting.admin_channel_id)) {
        const adminCh = message.guild.channels.cache.get(setting.admin_channel_id);
        if (adminCh) await adminCh.send({ embeds: [revokeEmbed] }).catch(console.error);
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
