import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { t } from "../utils/i18n.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user")
    .addStringOption((opt) => opt.setName("user_id").setDescription("User ID").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction, client, lang) {
    const userId = interaction.options.getString("user_id");
    const reason = interaction.options.getString("reason") ?? t(lang, "commands.common.no_reason");

    const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!ban) return interaction.reply({ content: t(lang, "commands.unban.not_banned"), ephemeral: true });

    await interaction.guild.members.unban(userId, reason);
    await interaction.reply(t(lang, "commands.unban.success", { userId }));
    await sendModLog(interaction.client, interaction.guildId, { action: "unban", target: ban.user, moderator: interaction.user, reason });
  },
};
