import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { sendModLog } from "../utils/modLog.js";

export default {
  data: new SlashCommandBuilder()
    .setName("role")
    .setDescription("ユーザーのロールを管理します")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("操作を選択")
        .setRequired(true)
        .addChoices(
          { name: "add", value: "add" },
          { name: "remove", value: "remove" },
        ),
    )
    .addUserOption((opt) =>
      opt.setName("user").setDescription("対象ユーザー").setRequired(true),
    )
    .addRoleOption((opt) =>
      opt.setName("role").setDescription("対象ロール").setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("理由").setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const action = interaction.options.getString("action");
    const target = interaction.options.getUser("user");
    const role = interaction.options.getRole("role");
    const reason = interaction.options.getString("reason") ?? "なし";
    const member = await interaction.guild.members
      .fetch(target.id)
      .catch(() => null);

    if (!member)
      return interaction.editReply("対象ユーザーがサーバーにいません。");

    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.editReply("Botよりも上位のロールは操作できません。");
    }

    if (action === "add") {
      if (member.roles.cache.has(role.id)) {
        return interaction.editReply(
          "対象ユーザーはすでにこのロールを持っています。",
        );
      }
      await member.roles.add(role, reason);
      await sendModLog(
        interaction.guild,
        "role_add",
        target,
        interaction.user,
        reason,
        { role: role.id },
      );
      await interaction.editReply(
        `<@${target.id}> に <@&${role.id}> を付与しました。`,
      );
    }

    if (action === "remove") {
      if (!member.roles.cache.has(role.id)) {
        return interaction.editReply(
          "対象ユーザーはこのロールを持っていません。",
        );
      }
      await member.roles.remove(role, reason);
      await sendModLog(
        interaction.guild,
        "role_remove",
        target,
        interaction.user,
        reason,
        { role: role.id },
      );
      await interaction.editReply(
        `<@${target.id}> から <@&${role.id}> を剥奪しました。`,
      );
    }
  },
};
