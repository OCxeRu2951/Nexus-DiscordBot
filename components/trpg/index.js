/**
 * TRPG Core Entry Point
 * ------------------------------------------------------------
 * Slash Adapter (commands/dice.js) と Prefix Adapter (messageCreate.js) が
 * 共通で呼び出す唯一のTRPG判定経路。
 *
 *   TRPG Request (system, params, lang)
 *        │
 *        ▼
 *   getTrpgSystem()        (registry.js) システム存在確認
 *        │
 *        ▼
 *   system.validate()      (validator.js) 入力値検証
 *        │
 *        ▼
 *   system.perform()       (coc7.js / dnd5e.js) 判定実行（Fair Roller使用）
 *        │
 *        ▼
 *   { ok: true, result }   構造化データを返す（表示整形はしない）
 *
 * Dice Command / messageCreate.js に
 * `if (system === "coc7") ... else if (system === "dnd5e") ...` のような
 * 分岐を書かせないための集約点。新システム追加時もこのファイルは無変更でよい。
 */
import { getTrpgSystem } from "./registry.js";
import { TrpgValidationError, TRPG_VALIDATION_ERROR } from "./validator.js";
import { t } from "../../utils/i18n.js";

const ERROR_KEY_MAP = {
  [TRPG_VALIDATION_ERROR.UNKNOWN_TRPG_SYSTEM]: "errors.trpg.unknown_system",
  [TRPG_VALIDATION_ERROR.INVALID_TARGET]: "errors.trpg.invalid_target",
  [TRPG_VALIDATION_ERROR.INVALID_MODIFIER]: "errors.trpg.invalid_modifier",
  [TRPG_VALIDATION_ERROR.INVALID_TRPG_MODE]: "errors.trpg.invalid_mode",
  [TRPG_VALIDATION_ERROR.INVALID_BONUS_PENALTY_DICE]: "errors.trpg.invalid_bonus_penalty",
};

/**
 * @param {object} request
 * @param {string} request.system TRPGシステムID (例: "coc7", "dnd5e")
 * @param {object} request.params システム固有パラメータ (target, modifier, mode, bonusDice等)
 * @param {string} request.lang 表示言語
 * @param {() => number} [rng] テスト用の乱数注入（省略時 Math.random）
 * @returns {{ ok: true, systemId: string, result: object } | { ok: false, code: string, message: string }}
 */
export function performTrpgCheck({ system, params, lang }, rng = Math.random) {
  const def = getTrpgSystem(system);

  if (!def) {
    return {
      ok: false,
      code: TRPG_VALIDATION_ERROR.UNKNOWN_TRPG_SYSTEM,
      message: t(lang, ERROR_KEY_MAP[TRPG_VALIDATION_ERROR.UNKNOWN_TRPG_SYSTEM], { system }),
    };
  }

  try {
    def.validate(params);
  } catch (err) {
    if (err instanceof TrpgValidationError) {
      const key = ERROR_KEY_MAP[err.code] ?? "errors.trpg.rule_error";
      return { ok: false, code: err.code, message: t(lang, key, err.detail ?? {}) };
    }
    console.error("[trpg] Unexpected validation error:", err);
    return { ok: false, code: "TRPG_RULE_ERROR", message: t(lang, "commands.common.error") };
  }

  try {
    const result = def.perform(params, rng);
    return { ok: true, systemId: def.id, result };
  } catch (err) {
    // ユーザー入力ミスではなく内部エラーなのでログへ残す
    console.error("[trpg] Unexpected error during perform:", err);
    return {
      ok: false,
      code: "TRPG_RULE_ERROR",
      message: t(lang, "commands.common.error"),
    };
  }
}
