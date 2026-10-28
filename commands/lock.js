import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from "discord.js";
import { t } from "../utils/i18n.js";
import { getExecutor } from "../utils/hierarchy.js";

export default {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock or unlock a channel")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt.setName("action").setDescription("Action").setRequired(true)
        .addChoices({ name: "lock", value: "lock" }, { name: "unlock", value: "unlock" }),
    )
    .addChannelOption((opt) => opt.setName("channel").setDescription("Target channel").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction, client, lang) {
    const action  = interaction.options.getString("action");
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    const everyone = interaction.guild.roles.everyone;

    // コマンドを使える権限は実行したチャンネルで判定されるため、対象チャンネルでもチャンネル管理を持つか確認する
    const executor = await getExecutor(interaction);
    if (!executor || !channel.permissionsFor?.(executor)?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: t(lang, "commands.common.no_permission"), ephemeral: true });
    }

    if (action === "lock") {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: false });
      await channel.send(t(lang, "commands.lock.locked"));
      return interaction.reply({ content: t(lang, "commands.lock.lock_success", { channelId: channel.id }), ephemeral: true });
    } else {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: null });
      await channel.send(t(lang, "commands.lock.unlocked"));
      return interaction.reply({ content: t(lang, "commands.lock.unlock_success", { channelId: channel.id }), ephemeral: true });
    }
  },
};
