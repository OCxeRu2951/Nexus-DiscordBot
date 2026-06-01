import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { t } from "../utils/i18n.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("role")
    .setDescription("Grant or revoke a role")
    .addStringOption((opt) =>
      opt.setName("action").setDescription("Action").setRequired(true)
        .addChoices({ name: "add", value: "add" }, { name: "remove", value: "remove" }),
    )
    .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
    .addRoleOption((opt) => opt.setName("role").setDescription("Target role").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction, client, lang) {
    const action = interaction.options.getString("action");
    const target = interaction.options.getUser("user");
    const role   = interaction.options.getRole("role");
    const member = interaction.guild.members.cache.get(target.id);

    if (!member) return interaction.reply({ content: t(lang, "commands.role.not_found"), ephemeral: true });
    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.reply({ content: t(lang, "commands.role.too_high"), ephemeral: true });
    }

    if (action === "add") {
      if (member.roles.cache.has(role.id)) return interaction.reply({ content: t(lang, "commands.role.already_has"), ephemeral: true });
      await member.roles.add(role);
      await interaction.reply(t(lang, "commands.role.add_success", { userId: target.id, roleId: role.id }));
    } else {
      if (!member.roles.cache.has(role.id)) return interaction.reply({ content: t(lang, "commands.role.not_has"), ephemeral: true });
      await member.roles.remove(role);
      await interaction.reply(t(lang, "commands.role.remove_success", { userId: target.id, roleId: role.id }));
    }

    await sendModLog(interaction.client, interaction.guildId, { action: `role_${action}`, target, moderator: interaction.user, reason: `${action} <@&${role.id}>` });
  },
};
