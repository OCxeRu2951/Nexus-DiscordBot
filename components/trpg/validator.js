/**
 * TRPG Validator
 * ------------------------------------------------------------
 * 責務: TRPG判定の入力値検証だけ。乱数生成・判定は行わない。
 *
 * registry.js との循環importを避けるため、システムIDの存在確認は
 * ここでは行わない（呼び出し側 components/trpg/index.js が
 * getTrpgSystem() の戻り値がnullかどうかで判定する）。
 */
import { DND5E_MODE } from "./dnd5e.js";

export const TRPG_VALIDATION_ERROR = {
  UNKNOWN_TRPG_SYSTEM: "UNKNOWN_TRPG_SYSTEM",
  INVALID_TARGET: "INVALID_TARGET",
  INVALID_MODIFIER: "INVALID_MODIFIER",
  INVALID_TRPG_MODE: "INVALID_TRPG_MODE",
  INVALID_BONUS_PENALTY_DICE: "INVALID_BONUS_PENALTY_DICE",
};

export const COC_TARGET_MIN = 1;
export const COC_TARGET_MAX = 100;
export const COC_BONUS_PENALTY_MAX = 5;

export const DND_MODIFIER_MIN = -20;
export const DND_MODIFIER_MAX = 20;

export class TrpgValidationError extends Error {
  constructor(code, detail = {}) {
    super(code);
    this.name = "TrpgValidationError";
    this.code = code;
    this.detail = detail;
  }
}

export function validateCoc7Params({ target, bonusDice = 0, penaltyDice = 0 }) {
  if (!Number.isInteger(target) || target < COC_TARGET_MIN || target > COC_TARGET_MAX) {
    throw new TrpgValidationError(TRPG_VALIDATION_ERROR.INVALID_TARGET, {
      min: COC_TARGET_MIN,
      max: COC_TARGET_MAX,
    });
  }
  if (
    !Number.isInteger(bonusDice) ||
    !Number.isInteger(penaltyDice) ||
    bonusDice < 0 ||
    penaltyDice < 0 ||
    bonusDice > COC_BONUS_PENALTY_MAX ||
    penaltyDice > COC_BONUS_PENALTY_MAX
  ) {
    throw new TrpgValidationError(TRPG_VALIDATION_ERROR.INVALID_BONUS_PENALTY_DICE, {
      max: COC_BONUS_PENALTY_MAX,
    });
  }
}

// CoC6版もCoC7版と同じ範囲（1-100技能値、0-5個のBonus/Penalty Dice）を採用する。
// 判定ロジック(evaluate)は別だが、入力値の妥当性の範囲は共通のためそのまま再利用する。
export const validateCoc6Params = validateCoc7Params;

export function validateDnd5eParams({ modifier = 0, mode = DND5E_MODE.NORMAL }) {
  if (!Number.isInteger(modifier) || modifier < DND_MODIFIER_MIN || modifier > DND_MODIFIER_MAX) {
    throw new TrpgValidationError(TRPG_VALIDATION_ERROR.INVALID_MODIFIER, {
      min: DND_MODIFIER_MIN,
      max: DND_MODIFIER_MAX,
    });
  }
  if (!Object.values(DND5E_MODE).includes(mode)) {
    throw new TrpgValidationError(TRPG_VALIDATION_ERROR.INVALID_TRPG_MODE, { mode });
  }
}
