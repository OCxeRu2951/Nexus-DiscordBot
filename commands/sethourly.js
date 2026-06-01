import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("sethourly")
    .setDescription("Manage hourly announcement settings")
    .addStringOption((opt) =>
      opt.setName("action").setDescription("Action").setRequired(true)
        .addChoices(
          { name: "set",   value: "set"   },
          { name: "unset", value: "unset" },
        ),
    )
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("Hourly channel (set only)").setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, client, lang) {
    const action = interaction.options.getString("action");

    if (action === "set") {
      const channel = interaction.options.getChannel("channel");
      if (!channel) {
        return interaction.reply({
          content:   t(lang, "commands.sethourly.no_channel"),
          ephemeral: true,
        });
      }
      await db.execute({
        sql:  `INSERT OR REPLACE INTO settings (guild_id, hourly_channel_id) VALUES (?, ?)`,
        args: [interaction.guildId, channel.id],
      });
      return interaction.reply(t(lang, "commands.sethourly.set", { channel: `<#${channel.id}>` }));
    }

    if (action === "unset") {
      await db.execute({
        sql:  `UPDATE settings SET hourly_channel_id = NULL WHERE guild_id = ?`,
        args: [interaction.guildId],
      });
      return interaction.reply(t(lang, "commands.sethourly.unset"));
    }
  },
};
