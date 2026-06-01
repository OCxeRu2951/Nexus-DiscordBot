import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { t } from "../utils/i18n.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove a timeout from a user")
    .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client, lang) {
    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") ?? t(lang, "commands.common.no_reason");
    const member = interaction.guild.members.cache.get(target.id);

    if (!member) return interaction.reply({ content: t(lang, "commands.untimeout.not_found"), ephemeral: true });
    if (!member.isCommunicationDisabled()) return interaction.reply({ content: t(lang, "commands.untimeout.not_timeout"), ephemeral: true });

    await member.timeout(null, reason);
    await interaction.reply(t(lang, "commands.untimeout.success", { userId: target.id }));
    await sendModLog(interaction.client, interaction.guildId, { action: "untimeout", target, moderator: interaction.user, reason });
  },
};
