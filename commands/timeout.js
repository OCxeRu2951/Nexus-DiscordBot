import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { t } from "../utils/i18n.js";
import { sendModLog } from "../utils/modLog.js";

const DURATION_MAP = {
  "60": "1分/1min", "300": "5分/5min", "600": "10分/10min",
  "1800": "30分/30min", "3600": "1時間/1h", "21600": "6時間/6h",
  "86400": "1日/1day", "604800": "1週間/1wk",
};

export default {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Set a timeout for a user")
    .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
    .addStringOption((opt) =>
      opt.setName("duration").setDescription("Duration").setRequired(true)
        .addChoices(
          { name: "1分/1min",    value: "60"     },
          { name: "5分/5min",    value: "300"    },
          { name: "10分/10min",  value: "600"    },
          { name: "30分/30min",  value: "1800"   },
          { name: "1時間/1h",    value: "3600"   },
          { name: "6時間/6h",    value: "21600"  },
          { name: "1日/1day",    value: "86400"  },
          { name: "1週間/1wk",   value: "604800" },
        ),
    )
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client, lang) {
    const target     = interaction.options.getUser("user");
    const duration   = interaction.options.getString("duration");
    const reason     = interaction.options.getString("reason") ?? t(lang, "commands.common.no_reason");
    const durationMs = parseInt(duration) * 1000;
    const durationStr = DURATION_MAP[duration] ?? duration;

    if (target.id === interaction.user.id) return interaction.reply({ content: t(lang, "commands.timeout.self"), ephemeral: true });
    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return interaction.reply({ content: t(lang, "commands.timeout.not_found"), ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: t(lang, "commands.timeout.no_permission"), ephemeral: true });

    await member.timeout(durationMs, reason);
    await interaction.reply(t(lang, "commands.timeout.success", { userId: target.id, duration: durationStr }));
    await target.send(t(lang, "commands.timeout.dm", { guild: interaction.guild.name, duration: durationStr, reason })).catch(() => {});
    await sendModLog(interaction.client, interaction.guildId, { action: "timeout", target, moderator: interaction.user, reason, extra: durationStr });
  },
};
