/**
 * TRPG Rule: Dungeons & Dragons 5e
 * ------------------------------------------------------------
 * 責務: D&D5e の 1d20 判定ロジックのみ。
 * Discord・DB・Prefix Permission等には一切依存しない。
 *
 * Natural 20 / Natural 1 について（仕様書 第10項対応）:
 *   本Ruleは選ばれたd20の生値を naturalRoll として結果に含めるだけで、
 *   「Natural20=絶対成功」「Natural1=絶対失敗」という意味付けは行わない。
 *   Attack RollとAbility Checkでは意味が異なるため、実際の解釈は
 *   Formatter / 呼び出し側（Slash Adapter, Prefix Adapter）に委ねる。
 */
import { rollDie } from "../dice/engine.js";

export const DND5E_MODE = {
  NORMAL: "normal",
  ADVANTAGE: "advantage",
  DISADVANTAGE: "disadvantage",
};

/**
 * 1d20を振る（Advantage/Disadvantage対応）。常にFair Roller。
 *
 * @param {"normal"|"advantage"|"disadvantage"} mode
 * @param {() => number} [rng]
 * @returns {{ rolls: number[], selectedRoll: number, mode: string }}
 */
export function rollD20(mode = DND5E_MODE.NORMAL, rng = Math.random) {
  if (mode === DND5E_MODE.ADVANTAGE || mode === DND5E_MODE.DISADVANTAGE) {
    const rolls = [rollDie(20, rng), rollDie(20, rng)];
    const selectedRoll =
      mode === DND5E_MODE.ADVANTAGE ? Math.max(...rolls) : Math.min(...rolls);
    return { rolls, selectedRoll, mode };
  }

  const roll = rollDie(20, rng);
  return { rolls: [roll], selectedRoll: roll, mode: DND5E_MODE.NORMAL };
}

/**
 * 選ばれたd20値・修正値・（任意の）目標値から結果を組み立てる純粋関数。
 * 乱数は扱わない（roll/evaluateの分離、テスト容易性のため）。
 *
 * @param {{ selectedRoll: number, modifier?: number, target?: number|null }} params
 * @returns {{ total: number, success: boolean|null, naturalRoll: number }}
 */
export function evaluateDnd5e({ selectedRoll, modifier = 0, target = null }) {
  const total = selectedRoll + modifier;
  const success = target === null || target === undefined ? null : total >= target;

  return {
    total,
    success,
    naturalRoll: selectedRoll,
  };
}

/**
 * ロール＋評価をまとめて行う高レベル関数。
 * Slash/Prefix Adapterはこれだけ呼べばよい。
 *
 * @param {{ modifier?: number, mode?: string, target?: number|null }} params
 * @param {() => number} [rng]
 * @returns {{
 *   system: "dnd5e",
 *   rolls: number[],
 *   selectedRoll: number,
 *   mode: string,
 *   modifier: number,
 *   total: number,
 *   success: boolean|null,
 *   naturalRoll: number,
 * }}
 */
export function performDnd5eCheck({ modifier = 0, mode = DND5E_MODE.NORMAL, target = null }, rng = Math.random) {
  const { rolls, selectedRoll } = rollD20(mode, rng);
  const { total, success, naturalRoll } = evaluateDnd5e({ selectedRoll, modifier, target });

  return {
    system: "dnd5e",
    rolls,
    selectedRoll,
    mode,
    modifier,
    total,
    success,
    naturalRoll,
  };
}
