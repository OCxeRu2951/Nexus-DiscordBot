import { SlashCommandBuilder } from "discord.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("dice")
    .setDescription("Roll dice")
    .addIntegerOption((opt) =>
      opt.setName("sides").setDescription("Number of sides").setRequired(false).setMinValue(2).setMaxValue(1000),
    )
    .addStringOption((opt) =>
      opt.setName("modifier").setDescription("Modifier").setRequired(false)
        .addChoices(
          { name: "buff (advantage)",   value: "buff"   },
          { name: "debuff (disadvantage)", value: "debuff" },
        ),
    ),

  async execute(interaction, client, lang) {
    const sides    = interaction.options.getInteger("sides") ?? 6;
    const modifier = interaction.options.getString("modifier");
    const roll     = () => Math.floor(Math.random() * sides) + 1;

    let result, detail;
    if (modifier === "buff") {
      const r1 = roll(), r2 = roll();
      result = Math.max(r1, r2);
      detail = `[${r1}, ${r2}] → ${t(lang, "commands.dice.buff_label")}`;
    } else if (modifier === "debuff") {
      const r1 = roll(), r2 = roll();
      result = Math.min(r1, r2);
      detail = `[${r1}, ${r2}] → ${t(lang, "commands.dice.debuff_label")}`;
    } else {
      result = roll();
      detail = null;
    }

    const msg = detail
      ? `🎲 **d${sides}**: ${result}\n${detail}`
      : `🎲 **d${sides}**: **${result}**`;

    return interaction.reply(msg);
  },
};
