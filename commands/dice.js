/**
 * Slash Adapter: /dice
 * ------------------------------------------------------------
 * 責務: Slash Interactionの入力を Dice Request / TRPG Request へ変換し、
 * components/dice または components/trpg を呼び出すだけ。
 * 乱数生成・判定ロジックはここに書かない。
 *
 * 設計上の解釈（今回の指示対応）:
 *   「グループごとの計算（複数Dice Groupの式 2d6+1d4-3 等）はPrefix限定コマンドとして
 *   扱う」との指示のため、Slash側からは expression オプションを削除した。
 *   components/dice/parser.js 等の実装自体はPrefix Adapter (messageCreate.js) から
 *   引き続き利用されるため変更していない。
 *
 * 3つのモードを持つ:
 *   1. Legacy mode : sides / count / modifier / buff / debuff / set / show_odds
 *                    既存 /dice の挙動をそのまま維持（後方互換）。
 *   2. TRPG mode    : system オプションを指定した場合。
 *                     components/trpg (Registry/Rule/Validator) を経由する。
 *
 * TRPG modeとLegacy modeのオプションは意味が異なるため同時指定を禁止する
 * （expression時と同様の競合ガード方式）。
 * ただし modifier は Legacy(固定値加算) と D&D5e(修正値) で意味が共通のため
 * 両モードで共有オプションとして扱う。
 */
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { t } from "../utils/i18n.js";
import {
  calculateBiasedFaceOdds,
  weightedRandomFace,
} from "../components/dice/odds.js";
import { performTrpgCheck } from "../components/trpg/index.js";
import { listTrpgSystemChoices } from "../components/trpg/registry.js";
import { DND5E_MODE } from "../components/trpg/dnd5e.js";
import { getTrpgFormatter, getTrpgColor } from "../components/trpg/formatter.js";

const COC_SYSTEM_IDS = new Set(["coc6", "coc7"]);

export default {
  data: new SlashCommandBuilder()
    .setName("dice")
    .setDescription("Roll dice")
    // ---- Legacy mode options ----
    .addIntegerOption((opt) =>
      opt
        .setName("sides")
        .setDescription("Number of sides (2-100) [legacy mode]")
        .setRequired(false)
        .setMinValue(2)
        .setMaxValue(100),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("count")
        .setDescription("Number of dice (1-10) [legacy mode]")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("set")
        .setDescription("Number of sets (1-10) [legacy mode]")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("modifier")
        .setDescription("Add/subtract from result [legacy] / D&D5e modifier [trpg]")
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("buff")
        .setDescription("Bias toward high values (0-100%) [legacy mode]")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(100),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("debuff")
        .setDescription("Bias toward low values (0-100%) [legacy mode]")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(100),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("show_odds")
        .setDescription("Show probability info (default: false) [legacy mode]")
        .setRequired(false),
    )
    // ---- TRPG mode options ----
    .addStringOption((opt) =>
      opt
        .setName("system")
        .setDescription("TRPG system (enables TRPG mode)")
        .setRequired(false)
        .addChoices(...listTrpgSystemChoices()),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("target")
        .setDescription("Target number / skill value [trpg: coc7 required, dnd5e optional DC]")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("bonus_dice")
        .setDescription("CoC7 bonus dice count (0-5)")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(5),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("penalty_dice")
        .setDescription("CoC7 penalty dice count (0-5)")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(5),
    )
    .addStringOption((opt) =>
      opt
        .setName("mode")
        .setDescription("D&D5e roll mode")
        .setRequired(false)
        .addChoices(
          { name: "Normal", value: DND5E_MODE.NORMAL },
          { name: "Advantage", value: DND5E_MODE.ADVANTAGE },
          { name: "Disadvantage", value: DND5E_MODE.DISADVANTAGE },
        ),
    ),

  async execute(interaction, client, lang) {
    const system = interaction.options.getString("system");

    const sides = interaction.options.getInteger("sides");
    const count = interaction.options.getInteger("count");
    const modifier = interaction.options.getInteger("modifier");
    const buff = interaction.options.getInteger("buff") ?? 0;
    const debuff = interaction.options.getInteger("debuff") ?? 0;
    const sets = interaction.options.getInteger("set") ?? 1;
    const showOdds = interaction.options.getBoolean("show_odds") ?? false;

    const usesLegacyOnlyOptions =
      sides !== null || count !== null || buff > 0 || debuff > 0 || sets > 1 || showOdds;

    // TRPG modeとLegacy専用オプションの同時指定は禁止（意味が競合するため）
    if (system && usesLegacyOnlyOptions) {
      return interaction.reply({
        content: t(lang, "commands.dice.trpg_legacy_conflict"),
        ephemeral: true,
      });
    }

    // ---- TRPG mode ----
    if (system) {
      return executeTrpgMode(interaction, lang, system, {
        target: interaction.options.getInteger("target"),
        modifier: modifier ?? 0,
        bonusDice: interaction.options.getInteger("bonus_dice") ?? 0,
        penaltyDice: interaction.options.getInteger("penalty_dice") ?? 0,
        mode: interaction.options.getString("mode") ?? DND5E_MODE.NORMAL,
      });
    }

    // ---- Legacy mode（既存 /dice の挙動をそのまま維持）----
    return executeLegacyMode(interaction, lang, {
      sides: sides ?? 6,
      count: count ?? 1,
      modifier: modifier ?? 0,
      buff,
      debuff,
      sets,
      showOdds,
    });
  },
};

// ============================================================
// TRPG mode
// ============================================================

async function executeTrpgMode(interaction, lang, system, { target, modifier, bonusDice, penaltyDice, mode }) {
  const params = COC_SYSTEM_IDS.has(system)
    ? { target, bonusDice, penaltyDice }
    : { modifier, mode, target: target ?? null };

  const outcome = performTrpgCheck({ system, params, lang });

  if (!outcome.ok) {
    return interaction.reply({ content: outcome.message, ephemeral: true });
  }

  const { systemId, result } = outcome;
  const fmt = getTrpgFormatter(systemId);

  const embed = new EmbedBuilder()
    .setTitle(fmt.title())
    .setColor(getTrpgColor(systemId, result))
    .setDescription(fmt.detailed(result, lang))
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

// ============================================================
// Legacy mode（既存 /dice のロジックをそのまま移設。互換性維持のため）
// ============================================================

async function executeLegacyMode(interaction, lang, { sides, count, modifier, buff, debuff, sets, showOdds }) {
  if (buff + debuff > 200) {
    return interaction.reply({
      content: t(lang, "commands.dice.error_buff_debuff"),
      ephemeral: true,
    });
  }

  const oddsTable = calculateBiasedFaceOdds(sides, buff, debuff);
  const normalizedWeights = oddsTable.map((o) => o.probability);

  const results = [];
  for (let s = 0; s < sets; s++) {
    const rolls = [];
    for (let c = 0; c < count; c++) {
      rolls.push(weightedRandomFace(sides, normalizedWeights));
    }
    const sum = rolls.reduce((a, b) => a + b, 0);
    results.push({ rolls, sum, total: sum + modifier });
  }

  const header = buildLegacyHeader(count, sides, sets, modifier, buff, debuff, lang);
  const lines = buildLegacyResultLines(results, modifier, sets, lang);

  const embed = new EmbedBuilder()
    .setTitle(header)
    .setColor(
      buff > 0 && debuff === 0 ? 0x2ecc71 : debuff > 0 && buff === 0 ? 0xe74c3c : 0x5865f2,
    )
    .setDescription(lines)
    .setTimestamp();

  if (showOdds) {
    const oddsLines = buildLegacyOddsLines(buff, debuff, oddsTable, lang);
    embed.addFields({ name: t(lang, "commands.dice.odds_title"), value: oddsLines });
  }

  return interaction.reply({ embeds: [embed] });
}

function buildLegacyHeader(count, sides, sets, modifier, buff, debuff, lang) {
  let header = `🎲 ${count}d${sides}`;
  if (sets > 1) header += ` × ${sets}${t(lang, "commands.dice.set_unit")}`;
  if (modifier !== 0) header += `  modifier: ${modifier > 0 ? "+" : ""}${modifier}`;
  if (buff > 0) header += `  buff: ${buff}%`;
  if (debuff > 0) header += `  debuff: ${debuff}%`;
  return header;
}

function buildLegacyResultLines(results, modifier, sets, lang) {
  const lines = [];
  for (let i = 0; i < results.length; i++) {
    const { rolls, sum, total } = results[i];
    const rollStr = rolls.join(" + ");
    const modStr = modifier !== 0 ? ` (${modifier > 0 ? "+" : ""}${modifier})` : "";
    const prefix = sets > 1 ? `${t(lang, "commands.dice.set_label", { n: i + 1 })}: ` : "";
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

function buildLegacyOddsLines(buff, debuff, oddsTable, lang) {
  const lines = [];
  lines.push(`buff: ${buff}% / debuff: ${debuff}%`);
  lines.push(t(lang, "commands.dice.odds_each"));
  const oddsStr = oddsTable
    .map((o) => `**${o.face}**: ${(o.probability * 100).toFixed(1)}%`)
    .join("　");
  lines.push(oddsStr);
  return lines.join("\n");
}
