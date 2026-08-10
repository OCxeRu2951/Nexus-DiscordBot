/**
 * TRPG Rule: Call of Cthulhu 7th Edition
 * ------------------------------------------------------------
 * 責務: CoC7版の百分率判定ロジックのみ。
 * Discord・DB・Prefix Permission等には一切依存しない。
 *
 * 成功段階の閾値・Fumble条件は本ファイル内の THRESHOLDS に集約している。
 * 将来 House Rule で変更する場合はここだけ変更すればよい。
 *
 * 重要:
 *   CoCのBonus/Penalty Diceは、Nexus既存の buff/debuff（重み付き乱数）とは
 *   完全に別物である。ここでは常に Fair Roller（components/dice/engine.js の
 *   rollDie）を使い、公式ルール通り「もう1つの十の位ダイスを振って選択する」
 *   方式で有利/不利を表現する。出目の確率分布自体は歪めない。
 */
import { rollDie } from "../dice/engine.js";

// 成功段階の判定閾値（将来House Ruleへ変更する場合はここを編集する）
const THRESHOLDS = {
  criticalRoll: 1, // 1 = クリティカル（スペシャル）
  extremeDivisor: 5, // target / 5 以下 = Extreme Success
  hardDivisor: 2, // target / 2 以下 = Hard Success
  fumbleHighTarget: 100, // target >= 50 の場合、roll === 100 のみFumble
  fumbleLowTargetMin: 96, // target < 50 の場合、roll >= 96 でFumble
  fumbleLowTargetThreshold: 50,
};

export const COC7_DEGREE = {
  CRITICAL: "critical",
  EXTREME: "extreme",
  HARD: "hard",
  REGULAR: "regular",
  FAILURE: "failure",
  FUMBLE: "fumble",
};

/**
 * 1d100（百分率ダイス）を振る。Bonus/Penalty Diceに対応。
 * bonusDice と penaltyDice は 1:1 で相殺される（一般的なハウスルールと同様）。
 *
 * @param {number} bonusDice 0以上の整数
 * @param {number} penaltyDice 0以上の整数
 * @param {() => number} [rng] テスト用の乱数注入（省略時 Math.random）
 * @returns {{ roll: number, tensRolls: number[], chosenTensIndex: number, unitsDigit: number, netDice: number }}
 */
export function rollPercentile(bonusDice = 0, penaltyDice = 0, rng = Math.random) {
  const netDice = Math.max(0, bonusDice) - Math.max(0, penaltyDice);
  const tensDiceCount = 1 + Math.abs(netDice);

  // 十の位ダイス（0〜9）を必要な数だけ振る
  const tensRolls = Array.from({ length: tensDiceCount }, () => rollDie(10, rng) - 1);

  let chosenTensIndex = 0;
  if (netDice > 0) {
    // Bonus Dice: 最も低い十の位を採用（成功しやすい方）
    chosenTensIndex = tensRolls.indexOf(Math.min(...tensRolls));
  } else if (netDice < 0) {
    // Penalty Dice: 最も高い十の位を採用（失敗しやすい方）
    chosenTensIndex = tensRolls.indexOf(Math.max(...tensRolls));
  }

  const unitsDigit = rollDie(10, rng) - 1; // 0〜9
  const tensDigit = tensRolls[chosenTensIndex]; // 0〜9

  let roll = tensDigit * 10 + unitsDigit;
  if (roll === 0) roll = 100; // "00" + "0" は100として扱う

  return { roll, tensRolls, chosenTensIndex, unitsDigit, netDice };
}

/**
 * 出目 (roll) と技能値 (target) から成功段階を判定する純粋関数。
 * 乱数は一切扱わない（テスト容易性のため roll/evaluate を分離）。
 *
 * @param {{ roll: number, target: number }} params
 * @returns {{ degree: string, success: boolean }}
 */
export function evaluateCoc7({ roll, target }) {
  const isFumble =
    target >= THRESHOLDS.fumbleLowTargetThreshold
      ? roll === THRESHOLDS.fumbleHighTarget
      : roll >= THRESHOLDS.fumbleLowTargetMin;

  if (roll === THRESHOLDS.criticalRoll) {
    return { degree: COC7_DEGREE.CRITICAL, success: true };
  }
  if (isFumble) {
    return { degree: COC7_DEGREE.FUMBLE, success: false };
  }
  if (roll <= Math.floor(target / THRESHOLDS.extremeDivisor)) {
    return { degree: COC7_DEGREE.EXTREME, success: true };
  }
  if (roll <= Math.floor(target / THRESHOLDS.hardDivisor)) {
    return { degree: COC7_DEGREE.HARD, success: true };
  }
  if (roll <= target) {
    return { degree: COC7_DEGREE.REGULAR, success: true };
  }
  return { degree: COC7_DEGREE.FAILURE, success: false };
}

/**
 * ロール＋判定をまとめて行う高レベル関数。
 * Slash/Prefix Adapterはこれだけ呼べばよい。
 *
 * @param {{ target: number, bonusDice?: number, penaltyDice?: number }} params
 * @param {() => number} [rng]
 * @returns {{
 *   system: "coc7",
 *   roll: number,
 *   target: number,
 *   degree: string,
 *   success: boolean,
 *   bonusDice: number,
 *   penaltyDice: number,
 *   tensRolls: number[],
 * }}
 */
export function performCoc7Check({ target, bonusDice = 0, penaltyDice = 0 }, rng = Math.random) {
  const { roll, tensRolls } = rollPercentile(bonusDice, penaltyDice, rng);
  const { degree, success } = evaluateCoc7({ roll, target });

  return {
    system: "coc7",
    roll,
    target,
    degree,
    success,
    bonusDice,
    penaltyDice,
    tensRolls,
  };
}
