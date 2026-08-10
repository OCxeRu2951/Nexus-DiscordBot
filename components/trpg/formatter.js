/**
 * TRPG Formatter
 * ------------------------------------------------------------
 * 責務: TRPG Rule（coc7.js / dnd5e.js）が返す構造化データを
 * 表示用テキストへ変換するだけ。EmbedBuilder自体は組み立てない
 * （Adapter側がtitle/descriptionを使ってEmbedを作る）。
 *
 * Slash: Detailed Formatter（詳細）
 * Prefix: Compact Formatter（簡潔）
 * どちらも同じ判定結果データを受け取るだけで、判定ロジックの再計算はしない。
 */
import { t } from "../../utils/i18n.js";

const COC7_DEGREE_KEY = {
  critical: "trpg.coc7.critical",
  extreme: "trpg.coc7.extreme_success",
  hard: "trpg.coc7.hard_success",
  regular: "trpg.coc7.regular_success",
  failure: "trpg.coc7.failure",
  fumble: "trpg.coc7.fumble",
};

const COC6_DEGREE_KEY = {
  critical: "trpg.coc6.critical",
  regular: "trpg.coc6.regular_success",
  failure: "trpg.coc6.failure",
  fumble: "trpg.coc6.fumble",
};

const DND5E_MODE_KEY = {
  normal: "trpg.dnd5e.mode_normal",
  advantage: "trpg.dnd5e.mode_advantage",
  disadvantage: "trpg.dnd5e.mode_disadvantage",
};

// ============================================================
// CoC 7th
// ============================================================

export function formatCoc7Title() {
  return `🐙 ${"Call of Cthulhu 7th"}`;
}

export function formatCoc7Detailed(result, lang) {
  const degreeLabel = t(lang, COC7_DEGREE_KEY[result.degree] ?? result.degree);
  const lines = [
    `${t(lang, "trpg.common.roll")}: **${result.roll}** / ${t(lang, "trpg.common.target")}: **${result.target}**`,
  ];

  if (result.bonusDice > 0) {
    lines.push(t(lang, "trpg.coc7.bonus_dice_used", { count: result.bonusDice }));
  }
  if (result.penaltyDice > 0) {
    lines.push(t(lang, "trpg.coc7.penalty_dice_used", { count: result.penaltyDice }));
  }

  lines.push("");
  lines.push(`**${degreeLabel}**`);

  return lines.join("\n");
}

export function formatCoc7Compact(result, lang) {
  const degreeLabel = t(lang, COC7_DEGREE_KEY[result.degree] ?? result.degree);
  return `1d100 → ${result.roll} / ${result.target}\n${degreeLabel}`;
}

// ============================================================
// CoC 6th
// ============================================================

export function formatCoc6Title() {
  return `🐙 ${"Call of Cthulhu 6th"}`;
}

export function formatCoc6Detailed(result, lang) {
  const degreeLabel = t(lang, COC6_DEGREE_KEY[result.degree] ?? result.degree);
  const lines = [
    `${t(lang, "trpg.common.roll")}: **${result.roll}** / ${t(lang, "trpg.common.target")}: **${result.target}**`,
  ];

  if (result.bonusDice > 0) {
    lines.push(t(lang, "trpg.coc6.bonus_dice_used", { count: result.bonusDice }));
  }
  if (result.penaltyDice > 0) {
    lines.push(t(lang, "trpg.coc6.penalty_dice_used", { count: result.penaltyDice }));
  }

  lines.push("");
  lines.push(`**${degreeLabel}**`);

  return lines.join("\n");
}

export function formatCoc6Compact(result, lang) {
  const degreeLabel = t(lang, COC6_DEGREE_KEY[result.degree] ?? result.degree);
  return `1d100 → ${result.roll} / ${result.target}\n${degreeLabel}`;
}

// ============================================================
// D&D 5e
// ============================================================

export function formatDnd5eTitle() {
  return `⚔️ ${"D&D 5e"}`;
}

export function formatDnd5eDetailed(result, lang) {
  const modeLabel = t(lang, DND5E_MODE_KEY[result.mode] ?? result.mode);
  const modStr = result.modifier !== 0 ? ` ${result.modifier > 0 ? "+" : ""}${result.modifier}` : "";

  const lines = [`**${modeLabel}**`];

  if (result.rolls.length > 1) {
    lines.push(`${t(lang, "trpg.common.roll")}: [${result.rolls.join(", ")}] → ${result.selectedRoll}`);
  } else {
    lines.push(`${t(lang, "trpg.common.roll")}: ${result.selectedRoll}`);
  }

  lines.push(`${t(lang, "trpg.common.modifier")}: ${modStr || "+0"}`);
  lines.push("");
  lines.push(`${t(lang, "trpg.common.total")}: **${result.total}**`);

  const naturalNote = formatNaturalNote(result.naturalRoll, lang);
  if (naturalNote) lines.push(naturalNote);

  if (result.success !== null) {
    lines.push(result.success ? t(lang, "trpg.common.success") : t(lang, "trpg.common.failure"));
  }

  return lines.join("\n");
}

export function formatDnd5eCompact(result, lang) {
  const modStr = result.modifier !== 0 ? ` ${result.modifier > 0 ? "+" : ""}${result.modifier}` : "";
  const rollStr = result.rolls.length > 1 ? `[${result.rolls.join(", ")}]` : `${result.selectedRoll}`;

  const lines = [`${rollStr}${modStr ? ` ${modStr}` : ""} = ${result.total}`];
  const naturalNote = formatNaturalNote(result.naturalRoll, lang);
  if (naturalNote) lines.push(naturalNote);

  return lines.join("\n");
}

// naturalRoll の情報表示だけを行う。成功/失敗の意味付けはしない（仕様書 第10項）。
function formatNaturalNote(naturalRoll, lang) {
  if (naturalRoll === 20) return t(lang, "trpg.dnd5e.natural20");
  if (naturalRoll === 1) return t(lang, "trpg.dnd5e.natural1");
  return null;
}

// ============================================================
// システム横断ディスパッチ
// ------------------------------------------------------------
// Adapter（Slash/Prefix）側が `if (systemId === "coc7") ... else if (...)`
// のような分岐を書かずに済むよう、Formatterをここで一元的に引けるようにする。
// 新システム追加時はこのマップへ1行足すだけでよい。
// ============================================================

export const TRPG_FORMATTERS = {
  coc7: { title: formatCoc7Title, detailed: formatCoc7Detailed, compact: formatCoc7Compact },
  coc6: { title: formatCoc6Title, detailed: formatCoc6Detailed, compact: formatCoc6Compact },
  dnd5e: { title: formatDnd5eTitle, detailed: formatDnd5eDetailed, compact: formatDnd5eCompact },
};

export function getTrpgFormatter(systemId) {
  return TRPG_FORMATTERS[systemId] ?? null;
}

const COC_DEGREE_COLOR = {
  critical: 0xf1c40f,
  extreme: 0x2ecc71,
  hard: 0x27ae60,
  regular: 0x3498db,
  failure: 0x95a5a6,
  fumble: 0xe74c3c,
};

const COC_SYSTEM_IDS = new Set(["coc6", "coc7"]);

/**
 * TRPG結果の表示色を返す。Embed生成側（Adapter）から呼ぶ。
 */
export function getTrpgColor(systemId, result) {
  if (COC_SYSTEM_IDS.has(systemId)) {
    return COC_DEGREE_COLOR[result.degree] ?? 0x5865f2;
  }
  if (systemId === "dnd5e") {
    return result.success === true ? 0x2ecc71 : result.success === false ? 0xe74c3c : 0x5865f2;
  }
  return 0x5865f2;
}
