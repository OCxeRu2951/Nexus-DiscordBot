import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("dice")
    .setDescription("ダイスを振ります")
    .addIntegerOption((opt) =>
      opt
        .setName("sides")
        .setDescription("ダイスの面数（2〜100）")
        .setRequired(false)
        .setMinValue(2)
        .setMaxValue(100),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("count")
        .setDescription("ダイスの個数（1〜10）")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("set")
        .setDescription("振る回数（1〜10）")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("modifier")
        .setDescription("結果への加減算")
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("buff")
        .setDescription("高い目への偏り（0〜100%）")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(100),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("debuff")
        .setDescription("低い目への偏り（0〜100%）")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(100),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("show_odds")
        .setDescription("確率情報を表示するか（デフォルト: false）")
        .setRequired(false),
    ),

  async execute(interaction) {
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
        content: "buff と debuff の合計は200%以下にしてください。",
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
    const header = buildHeader(count, sides, sets, modifier, buff, debuff);
    const lines = buildResultLines(results, modifier, sets);
    const oddsLines = showOdds
      ? buildOddsLines(sides, buff, debuff, normalizedWeights)
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
      embed.addFields({ name: "📊 確率情報", value: oddsLines });
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

function buildHeader(count, sides, sets, modifier, buff, debuff) {
  let header = `🎲 ${count}d${sides}`;
  if (sets > 1) header += ` × ${sets}セット`;
  if (modifier !== 0)
    header += `  modifier: ${modifier > 0 ? "+" : ""}${modifier}`;
  if (buff > 0) header += `  buff: ${buff}%`;
  if (debuff > 0) header += `  debuff: ${debuff}%`;
  return header;
}

// ---- 結果行 ----

function buildResultLines(results, modifier, sets) {
  const lines = [];

  for (let i = 0; i < results.length; i++) {
    const { rolls, sum, total } = results[i];
    const rollStr = rolls.join(" + ");
    const modStr = modifier !== 0 ? ` (${modifier > 0 ? "+" : ""}${modifier})` : "";
    const prefix = sets > 1 ? `セット${i + 1}: ` : "";
    lines.push(`内訳：${prefix}${rollStr} = ${sum}${modStr}\n結果：**${total}**`);
  }

  if (sets > 1) {
    const totalAll = results.reduce((a, r) => a + r.total, 0);
    const avg = (totalAll / sets).toFixed(1);
    lines.push("");
    lines.push(`合計: **${totalAll}**　平均: **${avg}**`);
  }

  return lines.join("\n");
}

// ---- 確率情報 ----

function buildOddsLines(sides, buff, debuff, normalizedWeights) {
  const lines = [];
  lines.push(`buff: ${buff}% / debuff: ${debuff}%`);
  lines.push("各面の出現確率:");

  const oddsStr = normalizedWeights
    .map((w, i) => `**${i + 1}**: ${(w * 100).toFixed(1)}%`)
    .join("　");
  lines.push(oddsStr);

  return lines.join("\n");
}
