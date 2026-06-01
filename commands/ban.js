import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { t } from "../utils/i18n.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false))
    .addIntegerOption((opt) => opt.setName("delete_days").setDescription("Delete message days (0-7)").setRequired(false).setMinValue(0).setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction, client, lang) {
    const target     = interaction.options.getUser("user");
    const reason     = interaction.options.getString("reason") ?? t(lang, "commands.common.no_reason");
    const deleteDays = interaction.options.getInteger("delete_days") ?? 0;

    if (target.id === interaction.user.id) return interaction.reply({ content: t(lang, "commands.ban.self"), ephemeral: true });
    const member = interaction.guild.members.cache.get(target.id);
    if (member && !member.bannable) return interaction.reply({ content: t(lang, "commands.ban.no_permission"), ephemeral: true });

    await target.send(t(lang, "commands.ban.dm", { guild: interaction.guild.name, reason })).catch(() => {});
    await interaction.guild.members.ban(target.id, { reason, deleteMessageDays: deleteDays });
    await interaction.reply(t(lang, "commands.ban.success", { userId: target.id }));
    await sendModLog(interaction.client, interaction.guildId, { action: "ban", target, moderator: interaction.user, reason });
  },
};
