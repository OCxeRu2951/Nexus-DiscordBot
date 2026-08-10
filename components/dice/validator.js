/**
 * Dice Validator
 * ------------------------------------------------------------
 * 責務: Parserが生成した terms[] が制限内かどうかを検証するだけ。
 * 乱数生成・表示は行わない。
 *
 * 制限値（公開Botとしての負荷対策）:
 *   Dice Group数        最大 3   （固定値termは対象外）
 *   1 Groupのダイス数    1 ~ 100
 *   ダイスの面数          2 ~ 1000
 *   固定補正値の範囲       -10000 ~ 10000
 */

export const MAX_DICE_GROUPS = 3;
export const MIN_DICE_COUNT = 1;
export const MAX_DICE_COUNT = 100;
export const MIN_DICE_SIDES = 2;
export const MAX_DICE_SIDES = 1000;
export const MIN_MODIFIER_VALUE = -10000;
export const MAX_MODIFIER_VALUE = 10000;

export const VALIDATION_ERROR = {
  TOO_MANY_DICE_GROUPS: "TOO_MANY_DICE_GROUPS",
  INVALID_DICE_COUNT: "INVALID_DICE_COUNT",
  INVALID_DICE_SIDES: "INVALID_DICE_SIDES",
  MODIFIER_LIMIT_EXCEEDED: "MODIFIER_LIMIT_EXCEEDED",
  NO_TERMS: "NO_TERMS",
};

export class DiceValidationError extends Error {
  constructor(code, detail = {}) {
    super(code);
    this.name = "DiceValidationError";
    this.code = code;
    this.detail = detail;
  }
}

/**
 * @param {{ terms: Array }} parsed parser.js の出力
 * @throws {DiceValidationError}
 */
export function validateDiceExpression(parsed) {
  const terms = parsed?.terms ?? [];

  if (terms.length === 0) {
    throw new DiceValidationError(VALIDATION_ERROR.NO_TERMS);
  }

  const diceGroups = terms.filter((t) => t.type === "dice");

  if (diceGroups.length > MAX_DICE_GROUPS) {
    throw new DiceValidationError(VALIDATION_ERROR.TOO_MANY_DICE_GROUPS, {
      max: MAX_DICE_GROUPS,
      actual: diceGroups.length,
    });
  }

  for (const term of terms) {
    if (term.type === "dice") {
      if (
        !Number.isInteger(term.count) ||
        term.count < MIN_DICE_COUNT ||
        term.count > MAX_DICE_COUNT
      ) {
        throw new DiceValidationError(VALIDATION_ERROR.INVALID_DICE_COUNT, {
          min: MIN_DICE_COUNT,
          max: MAX_DICE_COUNT,
          actual: term.count,
        });
      }
      if (
        !Number.isInteger(term.sides) ||
        term.sides < MIN_DICE_SIDES ||
        term.sides > MAX_DICE_SIDES
      ) {
        throw new DiceValidationError(VALIDATION_ERROR.INVALID_DICE_SIDES, {
          min: MIN_DICE_SIDES,
          max: MAX_DICE_SIDES,
          actual: term.sides,
        });
      }
    }

    if (term.type === "number") {
      if (
        !Number.isInteger(term.value) ||
        term.value < MIN_MODIFIER_VALUE ||
        term.value > MAX_MODIFIER_VALUE
      ) {
        throw new DiceValidationError(VALIDATION_ERROR.MODIFIER_LIMIT_EXCEEDED, {
          min: MIN_MODIFIER_VALUE,
          max: MAX_MODIFIER_VALUE,
          actual: term.value,
        });
      }
    }
  }

  return true;
}
