import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { t } from "../utils/i18n.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction, client, lang) {
    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") ?? t(lang, "commands.common.no_reason");

    if (target.id === interaction.user.id) return interaction.reply({ content: t(lang, "commands.kick.self"), ephemeral: true });
    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return interaction.reply({ content: t(lang, "commands.kick.not_found"), ephemeral: true });
    if (!member.kickable) return interaction.reply({ content: t(lang, "commands.kick.no_permission"), ephemeral: true });

    await target.send(t(lang, "commands.kick.dm", { guild: interaction.guild.name, reason })).catch(() => {});
    await member.kick(reason);
    await interaction.reply(t(lang, "commands.kick.success", { userId: target.id }));
    await sendModLog(interaction.client, interaction.guildId, { action: "kick", target, moderator: interaction.user, reason });
  },
};
