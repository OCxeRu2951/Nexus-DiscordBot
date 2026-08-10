/**
 * Dice Core Entry Point
 * ------------------------------------------------------------
 * Slash Adapter (commands/dice.js) と Prefix Adapter (messageCreate.js) が
 * 共通で呼び出す唯一のダイス処理経路。
 *
 *   Dice Request (expression, sets, lang)
 *        │
 *        ▼
 *   parseDiceExpression   (parser.js)
 *        │
 *        ▼
 *   validateDiceExpression (validator.js)
 *        │
 *        ▼
 *   rollExpressionSets     (engine.js)
 *        │
 *        ▼
 *   formatExpressionSets   (formatter.js)
 *
 * SlashとPrefixで別々の乱数生成・計算ロジックを持たないための集約点。
 * ここにDiscord固有の処理（reply等）は書かない。
 */

import { parseDiceExpression, DiceParseError } from "./parser.js";
import { validateDiceExpression, DiceValidationError } from "./validator.js";
import { rollExpressionSets } from "./engine.js";
import {
  formatExpressionSets,
  formatExpressionTitle,
} from "./formatter.js";
import { t } from "../../utils/i18n.js";

const MAX_SETS = 10;

// Parser/Validatorのエラーコード → i18nキーの対応表
const ERROR_KEY_MAP = {
  EMPTY_EXPRESSION: "errors.dice.invalid_expression",
  EXPRESSION_TOO_LONG: "errors.dice.expression_too_long",
  INVALID_EXPRESSION: "errors.dice.invalid_expression",
  TOO_MANY_DICE_GROUPS: "errors.dice.too_many_groups",
  INVALID_DICE_COUNT: "errors.dice.invalid_dice_count",
  INVALID_DICE_SIDES: "errors.dice.invalid_dice_sides",
  MODIFIER_LIMIT_EXCEEDED: "errors.dice.modifier_limit_exceeded",
  NO_TERMS: "errors.dice.invalid_expression",
};

/**
 * @param {object} request
 * @param {string} request.expression ダイス式 (例: "2d6+1d4-3")
 * @param {number} [request.sets] セット数 (1-10、省略時1)
 * @param {string} request.lang 表示言語
 * @returns {
 *   { ok: true, title: string, description: string, expression: string, totalPerSet: number[] } |
 *   { ok: false, code: string, message: string }
 * }
 */
export function rollDiceExpression({ expression, sets = 1, lang }) {
  const clampedSets = Math.min(Math.max(Number(sets) || 1, 1), MAX_SETS);

  let parsed;
  try {
    parsed = parseDiceExpression(expression);
    validateDiceExpression(parsed);
  } catch (err) {
    if (err instanceof DiceParseError || err instanceof DiceValidationError) {
      const key = ERROR_KEY_MAP[err.code] ?? "errors.dice.invalid_expression";
      return {
        ok: false,
        code: err.code,
        message: t(lang, key, err.detail ?? {}),
      };
    }
    // 想定外の内部エラーはユーザー入力ミスと区別してログに残す
    console.error("[dice] Unexpected error during parse/validate:", err);
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: t(lang, "commands.common.error"),
    };
  }

  const results = rollExpressionSets(parsed, clampedSets);

  return {
    ok: true,
    expression: parsed.expression,
    title: formatExpressionTitle(parsed.expression),
    description: formatExpressionSets(results, lang),
    totalPerSet: results.map((r) => r.total),
  };
}
