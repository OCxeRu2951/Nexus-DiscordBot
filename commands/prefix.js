import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { t } from "../utils/i18n.js";
import {
  setGuildPrefixMode,
  setChannelPrefixSetting,
  clearChannelPrefixSetting,
} from "../components/prefix/permission.js";

export default {
  data: new SlashCommandBuilder()
    .setName("dice-prefix")
    .setDescription("Manage d! prefix command permissions")
    .addSubcommand((sub) =>
      sub
        .setName("mode")
        .setDescription("Set the server-wide prefix mode")
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Prefix mode")
            .setRequired(true)
            .addChoices(
              { name: "All channels", value: "all" },
              { name: "Selected channels only", value: "selected" },
              { name: "Disabled", value: "disabled" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Set prefix permission for a specific channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Target channel")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("permission")
            .setDescription("Permission")
            .setRequired(true)
            .addChoices(
              { name: "Allow", value: "allow" },
              { name: "Deny", value: "deny" },
              { name: "Reset (use server default)", value: "reset" },
            ),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, client, lang) {
    const sub = interaction.options.getSubcommand();

    if (sub === "mode") {
      const mode = interaction.options.getString("mode");
      await setGuildPrefixMode(interaction.guildId, mode);
      return interaction.reply({
        content: t(lang, `commands.dice-prefix.mode_set_${mode}`),
        ephemeral: true,
      });
    }

    if (sub === "channel") {
      const channel = interaction.options.getChannel("channel");
      const permission = interaction.options.getString("permission");

      if (permission === "reset") {
        await clearChannelPrefixSetting(interaction.guildId, channel.id);
        return interaction.reply({
          content: t(lang, "commands.dice-prefix.channel_reset", {
            channelId: channel.id,
          }),
          ephemeral: true,
        });
      }

      await setChannelPrefixSetting(
        interaction.guildId,
        channel.id,
        permission,
      );
      return interaction.reply({
        content: t(lang, `commands.dice-prefix.channel_set_${permission}`, {
          channelId: channel.id,
        }),
        ephemeral: true,
      });
    }
  },
};
