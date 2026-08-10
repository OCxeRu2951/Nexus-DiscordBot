import { db } from "../utils/db.js";
import { resolveLang, t } from "../utils/i18n.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { normalizeForPrefix } from "../aspects/normalization.js";
import { isPrefixAllowed } from "../components/prefix/permission.js";
import { rollDiceExpression } from "../components/dice/index.js";
import { performTrpgCheck } from "../components/trpg/index.js";
import { parsePrefixTrpgShorthand } from "../components/trpg/prefixSyntax.js";
import { getTrpgFormatter, getTrpgColor } from "../components/trpg/formatter.js";

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

    // Messageオブジェクトには interaction.locale に相当する情報がないため、
    // 優先順位は ユーザー手動設定 → サーバー手動設定 → en となる
    const lang = await resolveLang({
      userId: message.author.id,
      guildId: message.guildId,
    });

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

    // ---- Prefix Adapter: r! / d! ダイスコマンド ----
    // 全角/半角の両対応のため NFKC 正規化してから判定する
    const normalizedForPrefix = normalizeForPrefix(message.content);
    if (normalizedForPrefix.startsWith("r!") || normalizedForPrefix.startsWith("d!")) {
      // Threadの場合は親チャンネルのOverrideも考慮する
      const parentChannelId =
        typeof message.channel?.isThread === "function" && message.channel.isThread()
          ? message.channel.parentId
          : null;

      const allowed = await isPrefixAllowed(message.guildId, message.channelId, parentChannelId);

      // 禁止チャンネルでは何も返信しない（silent ignore）
      if (!allowed) return;

      const expression = normalizedForPrefix.slice(2).trim();

      // ---- TRPG短縮構文（r!coc / r!dnd 等）を先に判定 ----
      // 汎用ダイス式と衝突しない構文のみ該当するため、既存挙動には影響しない
      const trpgShorthand = parsePrefixTrpgShorthand(expression);
      if (trpgShorthand) {
        const outcome = performTrpgCheck(
          { system: trpgShorthand.system, params: trpgShorthand.params, lang },
        );

        if (!outcome.ok) {
          await message.reply(outcome.message).catch(console.error);
          return;
        }

        const { systemId, result } = outcome;
        const fmt = getTrpgFormatter(systemId);
        const embed = new EmbedBuilder()
          .setTitle(fmt.title())
          .setColor(getTrpgColor(systemId, result))
          .setDescription(fmt.compact(result, lang))
          .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(console.error);
        return;
      }

      // ---- 汎用ダイス式（既存挙動）----
      // Prefix版は初期実装として set は常に1固定
      const result = rollDiceExpression({ expression, sets: 1, lang });

      if (!result.ok) {
        await message.reply(result.message).catch(console.error);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(result.title)
        .setColor(0x5865f2)
        .setDescription(result.description)
        .setTimestamp();

      await message.reply({ embeds: [embed] }).catch(console.error);
      return;
    }

    // ---- 申請コマンド ----
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
