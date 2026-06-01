import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Bulk delete messages")
    .addIntegerOption((opt) =>
      opt.setName("count").setDescription("Number of messages (1-100)").setRequired(true).setMinValue(1).setMaxValue(100),
    )
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Target user (optional)").setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction, client, lang) {
    const count  = interaction.options.getInteger("count");
    const target = interaction.options.getUser("user");

    await interaction.deferReply({ ephemeral: true });

    try {
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      let filtered = [...messages.values()];
      if (target) filtered = filtered.filter((m) => m.author.id === target.id);
      filtered = filtered.slice(0, count);

      const deleted = await interaction.channel.bulkDelete(filtered, true);
      return interaction.editReply(t(lang, "commands.clear.success", { count: deleted.size }));
    } catch {
      return interaction.editReply(t(lang, "commands.clear.fail"));
    }
  },
};
