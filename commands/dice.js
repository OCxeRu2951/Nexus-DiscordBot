import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { t } from "../utils/i18n.js";

export default {
  data: new SlashCommandBuilder()
    .setName("dice")
    .setDescription("Roll dice")
    .addIntegerOption((opt) =>
      opt
        .setName("sides")
        .setDescription("Number of sides (2-100)")
        .setRequired(false)
        .setMinValue(2)
        .setMaxValue(100),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("count")
        .setDescription("Number of dice (1-10)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("set")
        .setDescription("Number of sets (1-10)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("modifier")
        .setDescription("Add/subtract from result")
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("buff")
        .setDescription("Bias toward high values (0-100%)")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(100),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("debuff")
        .setDescription("Bias toward low values (0-100%)")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(100),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("show_odds")
        .setDescription("Show probability info (default: false)")
        .setRequired(false),
    ),

  async execute(interaction, client, lang) {
    const sides = interaction.options.getInteger("sides") ?? 6;
    const count = interaction.options.getInteger("count") ?? 1;
    const sets = interaction.options.getInteger("set") ?? 1;
    const modifier = interaction.options.getInteger("modifier") ?? 0;
    const buff = interaction.options.getInteger("buff") ?? 0;
    const debuff = interaction.options.getInteger("debuff") ?? 0;
    const showOdds = interaction.options.getBoolean("show_odds") ?? false;

    // バフ+デバフの上限チェック
    if (buff + debuff > 200) {
      return interaction.reply({
        content: t(lang, "commands.dice.error_buff_debuff"),
        ephemeral: true,
      });
    }

    // 重み計算
    const weights = buildWeights(sides, buff, debuff);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map((w) => w / totalWeight);

    // 各セットのロール
    const results = [];
    for (let s = 0; s < sets; s++) {
      const rolls = [];
      for (let c = 0; c < count; c++) {
        rolls.push(weightedRandom(sides, normalizedWeights));
      }
      const sum = rolls.reduce((a, b) => a + b, 0);
      results.push({ rolls, sum, total: sum + modifier });
    }

    // 出力構築
    const header = buildHeader(
      count,
      sides,
      sets,
      modifier,
      buff,
      debuff,
      lang,
    );
    const lines = buildResultLines(results, modifier, sets, lang);
    const oddsLines = showOdds
      ? buildOddsLines(sides, buff, debuff, normalizedWeights, lang)
      : null;

    const embed = new EmbedBuilder()
      .setTitle(header)
      .setColor(
        buff > 0 && debuff === 0
          ? 0x2ecc71
          : debuff > 0 && buff === 0
            ? 0xe74c3c
            : 0x5865f2,
      )
      .setDescription(lines)
      .setTimestamp();

    if (oddsLines) {
      embed.addFields({
        name: t(lang, "commands.dice.odds_title"),
        value: oddsLines,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

// ---- 重み計算 ----

function buildWeights(sides, buff, debuff) {
  const weights = [];
  for (let face = 1; face <= sides; face++) {
    const buffWeight =
      sides > 1 ? 1 + ((buff / 100) * (face - 1)) / (sides - 1) : 1;
    const debuffWeight =
      sides > 1 ? 1 + ((debuff / 100) * (sides - face)) / (sides - 1) : 1;
    weights.push(buffWeight * debuffWeight);
  }
  return weights;
}

// ---- 重み付き抽選 ----

function weightedRandom(sides, normalizedWeights) {
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < sides; i++) {
    cumulative += normalizedWeights[i];
    if (rand < cumulative) return i + 1;
  }
  return sides;
}

// ---- 出力ヘッダー ----

function buildHeader(count, sides, sets, modifier, buff, debuff, lang) {
  let header = `🎲 ${count}d${sides}`;
  if (sets > 1) header += ` × ${sets}${t(lang, "commands.dice.set_unit")}`;
  if (modifier !== 0)
    header += `  modifier: ${modifier > 0 ? "+" : ""}${modifier}`;
  if (buff > 0) header += `  buff: ${buff}%`;
  if (debuff > 0) header += `  debuff: ${debuff}%`;
  return header;
}

// ---- 結果行 ----

function buildResultLines(results, modifier, sets, lang) {
  const lines = [];

  for (let i = 0; i < results.length; i++) {
    const { rolls, sum, total } = results[i];
    const rollStr = rolls.join(" + ");
    const modStr =
      modifier !== 0 ? ` (${modifier > 0 ? "+" : ""}${modifier})` : "";
    const prefix =
      sets > 1 ? `${t(lang, "commands.dice.set_label", { n: i + 1 })}: ` : "";
    lines.push(`${prefix}${rollStr} = ${sum}${modStr} → **${total}**`);
  }

  if (sets > 1) {
    const totalAll = results.reduce((a, r) => a + r.total, 0);
    const avg = (totalAll / sets).toFixed(1);
    lines.push("");
    lines.push(t(lang, "commands.dice.total_avg", { total: totalAll, avg }));
  }

  return lines.join("\n");
}

// ---- 確率情報 ----

function buildOddsLines(sides, buff, debuff, normalizedWeights, lang) {
  const lines = [];
  lines.push(`buff: ${buff}% / debuff: ${debuff}%`);
  lines.push(t(lang, "commands.dice.odds_each"));

  const oddsStr = normalizedWeights
    .map((w, i) => `**${i + 1}**: ${(w * 100).toFixed(1)}%`)
    .join("　");
  lines.push(oddsStr);

  return lines.join("\n");
}
