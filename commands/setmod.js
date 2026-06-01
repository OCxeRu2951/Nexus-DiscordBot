import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("setmod")
    .setDescription("Configure moderation settings")
    .addSubcommand((sub) =>
      sub.setName("logchannel").setDescription("Set log channel")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Log channel").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("threshold").setDescription("Set warning threshold")
        .addIntegerOption((opt) =>
          opt.setName("points").setDescription("Points").setRequired(true).setMinValue(1),
        )
        .addStringOption((opt) =>
          opt.setName("action").setDescription("Action").setRequired(true)
            .addChoices(
              { name: "kick",    value: "kick"    },
              { name: "ban",     value: "ban"     },
              { name: "timeout", value: "timeout" },
            ),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client, lang) {
    const sub = interaction.options.getSubcommand();

    if (sub === "logchannel") {
      const channel = interaction.options.getChannel("channel");
      await db.execute({
        sql:  `INSERT INTO mod_settings (guild_id, log_channel_id) VALUES (?, ?)
               ON CONFLICT(guild_id) DO UPDATE SET log_channel_id = ?`,
        args: [interaction.guildId, channel.id, channel.id],
      });
      return interaction.reply({
        content:   t(lang, "commands.setmod.logchannel_set", { channelId: channel.id }),
        ephemeral: true,
      });
    }

    if (sub === "threshold") {
      const points = interaction.options.getInteger("points");
      const action = interaction.options.getString("action");
      await db.execute({
        sql:  `INSERT INTO mod_settings (guild_id, warn_threshold, warn_action) VALUES (?, ?, ?)
               ON CONFLICT(guild_id) DO UPDATE SET warn_threshold = ?, warn_action = ?`,
        args: [interaction.guildId, points, action, points, action],
      });
      return interaction.reply({
        content:   t(lang, "commands.setmod.threshold_set", { points, action }),
        ephemeral: true,
      });
    }
  },
};
