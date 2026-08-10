/**
 * TRPG Rule: Call of Cthulhu 6th Edition
 * ------------------------------------------------------------
 * 責務: CoC6版の百分率判定ロジックのみ。
 * Discord・DB・Prefix Permission等には一切依存しない。
 *
 * CoC7版 (coc7.js) との違い:
 *   CoC6版の基本ルールには Hard/Extreme Success の概念がなく、
 *   判定は「クリティカル / 通常成功 / 失敗 / ファンブル」の4区分のみ。
 *   （Opposed Rollでの成功度比較はここでは扱わない）
 *   ファンブル閾値もCoC7版のような技能値50を境にした分岐を持たず、
 *   96〜100の固定範囲とする（標準的な国内外の6版ルール運用に準拠）。
 *
 * 成功段階の閾値は本ファイル内の THRESHOLDS に集約している。
 * 将来 House Rule で変更する場合はここだけ変更すればよい。
 *
 * 重要:
 *   CoCのBonus/Penalty Diceは、Nexus既存の buff/debuff（重み付き乱数）とは
 *   完全に別物である。ここでは常に Fair Roller（components/dice/engine.js の
 *   rollDie）を使い、公式ルール通り「もう1つの十の位ダイスを振って選択する」
 *   方式で有利/不利を表現する。出目の確率分布自体は歪めない。
 *   （このBonus/Penalty Dice機構自体はCoC7版と共通のロジックのため、
 *   十の位選択部分は coc7.js の rollPercentile と同一の考え方で実装している。
 *   Rule自体は独立ファイルとして保守しやすさを優先し、あえて共有関数化していない）
 */
import { rollDie } from "../dice/engine.js";

// 成功段階の判定閾値（将来House Ruleへ変更する場合はここを編集する）
const THRESHOLDS = {
  criticalRoll: 1, // 1 = クリティカル
  fumbleMin: 96, // 96〜100 = ファンブル（技能値による分岐なし）
};

export const COC6_DEGREE = {
  CRITICAL: "critical",
  REGULAR: "regular",
  FAILURE: "failure",
  FUMBLE: "fumble",
};

/**
 * 1d100（百分率ダイス）を振る。Bonus/Penalty Diceに対応。
 * bonusDice と penaltyDice は 1:1 で相殺される。
 *
 * @param {number} bonusDice 0以上の整数
 * @param {number} penaltyDice 0以上の整数
 * @param {() => number} [rng] テスト用の乱数注入（省略時 Math.random）
 * @returns {{ roll: number, tensRolls: number[], chosenTensIndex: number, unitsDigit: number, netDice: number }}
 */
export function rollPercentile(bonusDice = 0, penaltyDice = 0, rng = Math.random) {
  const netDice = Math.max(0, bonusDice) - Math.max(0, penaltyDice);
  const tensDiceCount = 1 + Math.abs(netDice);

  const tensRolls = Array.from({ length: tensDiceCount }, () => rollDie(10, rng) - 1);

  let chosenTensIndex = 0;
  if (netDice > 0) {
    chosenTensIndex = tensRolls.indexOf(Math.min(...tensRolls));
  } else if (netDice < 0) {
    chosenTensIndex = tensRolls.indexOf(Math.max(...tensRolls));
  }

  const unitsDigit = rollDie(10, rng) - 1;
  const tensDigit = tensRolls[chosenTensIndex];

  let roll = tensDigit * 10 + unitsDigit;
  if (roll === 0) roll = 100;

  return { roll, tensRolls, chosenTensIndex, unitsDigit, netDice };
}

/**
 * 出目 (roll) と技能値 (target) から成功段階を判定する純粋関数。
 * 乱数は一切扱わない（テスト容易性のため roll/evaluate を分離）。
 *
 * @param {{ roll: number, target: number }} params
 * @returns {{ degree: string, success: boolean }}
 */
export function evaluateCoc6({ roll, target }) {
  if (roll >= THRESHOLDS.fumbleMin) {
    return { degree: COC6_DEGREE.FUMBLE, success: false };
  }
  if (roll === THRESHOLDS.criticalRoll) {
    return { degree: COC6_DEGREE.CRITICAL, success: true };
  }
  if (roll <= target) {
    return { degree: COC6_DEGREE.REGULAR, success: true };
  }
  return { degree: COC6_DEGREE.FAILURE, success: false };
}

/**
 * ロール＋判定をまとめて行う高レベル関数。
 * Slash/Prefix Adapterはこれだけ呼べばよい。
 *
 * @param {{ target: number, bonusDice?: number, penaltyDice?: number }} params
 * @param {() => number} [rng]
 * @returns {{
 *   system: "coc6",
 *   roll: number,
 *   target: number,
 *   degree: string,
 *   success: boolean,
 *   bonusDice: number,
 *   penaltyDice: number,
 *   tensRolls: number[],
 * }}
 */
export function performCoc6Check({ target, bonusDice = 0, penaltyDice = 0 }, rng = Math.random) {
  const { roll, tensRolls } = rollPercentile(bonusDice, penaltyDice, rng);
  const { degree, success } = evaluateCoc6({ roll, target });

  return {
    system: "coc6",
    roll,
    target,
    degree,
    success,
    bonusDice,
    penaltyDice,
    tensRolls,
  };
}
