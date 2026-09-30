import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { t } from "../utils/i18n.js";
import {
  getRecruitSettings,
  setListChannel,
  setThreadMode,
  setViewerRoles,
  VIEWER_ROLES_MAX,
} from "../components/recruit/settings.js";
import { updateRecruitList } from "../components/recruit/list.js";

const ephemeral = { flags: MessageFlags.Ephemeral };

export default {
  data: new SlashCommandBuilder()
    .setName("recruit-config")
    .setDescription("Configure recruitment settings")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt
        .setName("mode")
        .setDescription("Setting to change")
        .setRequired(true)
        .addChoices(
          { name: "list   — recruitment list channel",       value: "list"   },
          { name: "thread — thread or forum per recruitment", value: "thread" },
          { name: "viewer — dashboard viewer roles",          value: "viewer" },
          { name: "show   — show current settings",           value: "show"   },
        ),
    )
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("list: channel for the recruitment list (omit to disable)")
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    )
    .addStringOption((opt) =>
      opt
        .setName("type")
        .setDescription("thread: create a thread or a forum post")
        .setRequired(false)
        .addChoices(
          { name: "Thread", value: "thread" },
          { name: "Forum",  value: "forum"  },
        ),
    )
    .addChannelOption((opt) =>
      opt
        .setName("forum")
        .setDescription("thread: forum channel for recruitment posts (required for Forum)")
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildForum),
    )
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("viewer: add, remove or reset")
        .setRequired(false)
        .addChoices(
          { name: "Add",              value: "add"    },
          { name: "Remove",           value: "remove" },
          { name: "Reset (everyone)", value: "reset"  },
        ),
    )
    .addRoleOption((opt) =>
      opt
        .setName("role")
        .setDescription("viewer: target role")
        .setRequired(false),
    ),

  async execute(interaction, client, lang) {
    const mode    = interaction.options.getString("mode");
    const guildId = interaction.guildId;
    const k       = (key, vars) => t(lang, `commands.recruit-config.${key}`, vars);

    // ---- 更新リストのチャンネル ----
    if (mode === "list") {
      const channel = interaction.options.getChannel("channel");
      await interaction.deferReply(ephemeral);
      await setListChannel(guildId, channel?.id ?? null);

      let result;
      try {
        result = await updateRecruitList(client, guildId);
      } catch (err) {
        console.error("[recruit-config] list update failed:", err);
        result = "error";
      }

      if (!channel) return interaction.editReply(k("list_disabled"));
      if (result === "edited" || result === "created") {
        return interaction.editReply(k("list_set", { channelId: channel.id }));
      }
      return interaction.editReply(k("list_failed", { channelId: channel.id }));
    }

    // ---- スレッド / フォーラム ----
    if (mode === "thread") {
      const type  = interaction.options.getString("type");
      const forum = interaction.options.getChannel("forum");

      if (!type) return interaction.reply({ content: k("type_required"), ...ephemeral });

      if (type === "forum") {
        const current = await getRecruitSettings(guildId);
        if (!forum && !current.forum_channel_id) {
          return interaction.reply({ content: k("forum_required"), ...ephemeral });
        }
        await setThreadMode(guildId, "forum", forum?.id ?? null);
        const forumId = forum?.id ?? current.forum_channel_id;
        return interaction.reply({ content: k("thread_set_forum", { channelId: forumId }), ...ephemeral });
      }

      await setThreadMode(guildId, "thread", forum?.id ?? null);
      return interaction.reply({ content: k("thread_set_thread"), ...ephemeral });
    }

    // ---- ダッシュボードの閲覧ロール ----
    if (mode === "viewer") {
      const action  = interaction.options.getString("action");
      const role    = interaction.options.getRole("role");
      const current = (await getRecruitSettings(guildId)).viewer_role_ids;

      if (!action) return interaction.reply({ content: k("action_required"), ...ephemeral });

      if (action === "reset") {
        await setViewerRoles(guildId, []);
        return interaction.reply({ content: k("viewer_reset"), ...ephemeral });
      }

      if (!role) return interaction.reply({ content: k("viewer_role_required"), ...ephemeral });

      if (action === "add") {
        if (!current.includes(role.id) && current.length >= VIEWER_ROLES_MAX) {
          return interaction.reply({ content: k("viewer_limit", { max: VIEWER_ROLES_MAX }), ...ephemeral });
        }
        const next = await setViewerRoles(guildId, [...current, role.id]);
        return interaction.reply({
          content: k("viewer_added", { roleId: role.id, roles: formatRoles(next, lang) }),
          allowedMentions: { parse: [] },
          ...ephemeral,
        });
      }

      const next = await setViewerRoles(guildId, current.filter((id) => id !== role.id));
      return interaction.reply({
        content: k("viewer_removed", { roleId: role.id, roles: formatRoles(next, lang) }),
        allowedMentions: { parse: [] },
        ...ephemeral,
      });
    }

    // ---- 現在の設定 ----
    if (mode === "show") {
      const s = await getRecruitSettings(guildId);
      const embed = new EmbedBuilder()
        .setTitle(k("show_title"))
        .setColor(0xf07830)
        .addFields(
          {
            name:  k("show_list"),
            value: s.list_channel_id ? `<#${s.list_channel_id}>` : k("none"),
          },
          {
            name:  k("show_thread"),
            value: s.thread_mode === "forum"
              ? `${k("mode_forum")}${s.forum_channel_id ? ` (<#${s.forum_channel_id}>)` : ""}`
              : k("mode_thread"),
          },
          {
            name:  k("show_viewer"),
            value: formatRoles(s.viewer_role_ids, lang),
          },
        );
      return interaction.reply({ embeds: [embed], ...ephemeral });
    }
  },
};

function formatRoles(roleIds, lang) {
  return roleIds.length > 0
    ? roleIds.map((id) => `<@&${id}>`).join(" ")
    : t(lang, "commands.recruit-config.everyone");
}
