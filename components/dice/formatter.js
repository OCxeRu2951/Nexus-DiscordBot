/**
 * Dice Formatter
 * ------------------------------------------------------------
 * 責務: Engineの計算結果を「表示用データ」へ整形するだけ。
 * Discordの EmbedBuilder 生成そのものは行わない
 * （Slash Adapter / Prefix Adapter が受け取った内容でEmbedを組み立てる）。
 * i18nの t() を使い、文字列のハードコードを避ける。
 */

import { t } from "../../utils/i18n.js";

function formatTerm(term, lang) {
  if (term.type === "dice") {
    // ダイスグループは減算のときだけ "-" を明示する（加算側は暗黙表記）
    const sign = term.operator === "-" ? "-" : "";
    return t(lang, "commands.dice.expr_group_line", {
      sign,
      count: term.count,
      sides: term.sides,
      rolls: term.rolls.join(", "),
      subtotal: term.subtotal,
    });
  }
  // 固定値（補正）は常に符号を明示する
  const sign = term.operator === "-" ? "-" : "+";
  return t(lang, "commands.dice.expr_modifier_line", {
    sign,
    value: term.value,
  });
}

/**
 * 1セット分の結果を表示用テキストへ変換する。
 *
 * @param {{ expression: string, terms: Array, total: number }} result rollExpression() の出力
 * @param {string} lang
 * @returns {string}
 */
export function formatExpressionResult(result, lang) {
  const lines = result.terms.map((term) => formatTerm(term, lang));
  lines.push(t(lang, "commands.dice.expr_total", { total: result.total }));
  return lines.join("\n");
}

/**
 * 複数セット分の結果をまとめて表示用テキストへ変換する。
 *
 * @param {Array<{ terms: Array, total: number }>} results rollExpressionSets() の出力
 * @param {string} lang
 * @returns {string}
 */
export function formatExpressionSets(results, lang) {
  if (results.length === 1) {
    return formatExpressionResult(results[0], lang);
  }

  const blocks = results.map((result, i) => {
    const setLabel = t(lang, "commands.dice.expr_set_label", { n: i + 1 });
    return `**${setLabel}**\n${formatExpressionResult(result, lang)}`;
  });

  const totalAll = results.reduce((a, r) => a + r.total, 0);
  const avg = (totalAll / results.length).toFixed(1);
  blocks.push(t(lang, "commands.dice.expr_set_summary", { total: totalAll, avg }));

  return blocks.join("\n\n");
}

/**
 * Embedタイトル用の見出しを組み立てる（例: "🎲 2d6+1d4-3"）。
 */
export function formatExpressionTitle(expression) {
  return `🎲 ${expression}`;
}
