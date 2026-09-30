import {
  SlashCommandBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { t } from "../utils/i18n.js";
import { publishRecruit, displayNameOf } from "../components/recruit/index.js";
import { RECRUIT_LIMITS as L } from "../components/recruit/prefixSyntax.js";

export default {
  data: new SlashCommandBuilder()
    .setName("recruit")
    .setDescription("Create a recruitment post with join buttons")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt
        .setName("title")
        .setDescription("Recruitment title")
        .setRequired(true)
        .setMaxLength(L.titleMax),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("capacity")
        .setDescription("Number of participants (1-50, unlimited if omitted)")
        .setRequired(false)
        .setMinValue(L.capacityMin)
        .setMaxValue(L.capacityMax),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("duration")
        .setDescription("Minutes until the deadline (1-10080, none if omitted)")
        .setRequired(false)
        .setMinValue(L.durationMin)
        .setMaxValue(L.durationMax),
    )
    .addStringOption((opt) =>
      opt
        .setName("description")
        .setDescription("Details such as date, time and requirements")
        .setRequired(false)
        .setMaxLength(L.descriptionMax),
    )
    .addRoleOption((opt) =>
      opt
        .setName("mention")
        .setDescription("Role to notify when posting")
        .setRequired(false),
    ),

  async execute(interaction, client, lang) {
    const title       = interaction.options.getString("title").trim();
    const capacity    = interaction.options.getInteger("capacity");
    const duration    = interaction.options.getInteger("duration");
    const description = interaction.options.getString("description")?.trim() || null;
    const role        = interaction.options.getRole("mention");

    // ---- メンション権限チェック ----
    // Botの権限を借りて、本人がメンションできないロールや @everyone を鳴らせないようにする
    let mentionContent  = null;
    let allowedMentions = { parse: [] };

    if (role) {
      const canMentionEveryone =
        interaction.memberPermissions?.has(PermissionFlagsBits.MentionEveryone) ?? false;
      const isEveryone = role.id === interaction.guildId;

      if ((isEveryone || !role.mentionable) && !canMentionEveryone) {
        return interaction.reply({
          content: t(lang, "commands.recruit.mention_forbidden"),
          flags:   MessageFlags.Ephemeral,
        });
      }

      if (isEveryone) {
        mentionContent  = "@everyone";
        allowedMentions = { parse: ["everyone"] };
      } else {
        mentionContent  = `<@&${role.id}>`;
        allowedMentions = { roles: [role.id] };
      }
    }

    await interaction.deferReply();

    await publishRecruit(client, {
      send:      (payload) => interaction.editReply(payload),
      guildId:   interaction.guildId,
      channelId: interaction.channelId,
      authorId:  interaction.user.id,
      authorName: displayNameOf(interaction.member, interaction.user),
      title,
      description,
      capacity,
      endAt:     duration ? Date.now() + duration * 60 * 1000 : null,
      lang,
    });

    // 編集ではメンション通知が飛ばないため、ロール通知は別メッセージで送る
    if (mentionContent) {
      await interaction
        .followUp({
          content: t(lang, "commands.recruit.mention_notice", { mention: mentionContent, title }),
          allowedMentions,
        })
        .catch(console.error);
    }
  },
};
