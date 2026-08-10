/**
 * Odds Calculator
 * ------------------------------------------------------------
 * 責務: 確率分布の計算だけ。乱数の実際のロールは行わない。
 *
 * 現状の対応範囲:
 *   - 単一 Dice Group (例: "2d6" 単体) の正確な確率分布
 *   - 複数 Dice Group (例: "2d6+1d4") の分布計算は未対応
 *
 * 複数Dice Groupを未対応としている理由:
 *   複数グループの合計値分布は畳み込み（convolution）で理論上計算可能だが、
 *   ダイス数・面数の上限（最大100個 × 面数1000）の組み合わせによっては
 *   計算コストが無視できないサイズになりうる。今回の大規模リファクタリングでは
 *   既存機能（show_odds）を壊さないことを優先し、単一グループのみ厳密計算する。
 *
 * 将来の拡張ポイント:
 *   calculateGroupDistribution() が単一グループの分布を返す関数として
 *   独立しているため、複数グループ対応時は各グループの分布を計算してから
 *   畳み込み関数 convolve(distA, distB) を追加するだけで拡張できる。
 *   （本ファイルには convolve は含めていない）
 */

/**
 * 単一ダイスグループ (NdM) の正確な合計値分布を動的計画法で計算する。
 *
 * @param {number} count ダイスの個数
 * @param {number} sides 面数
 * @returns {Array<{ value: number, probability: number }>} 昇順の分布
 */
export function calculateGroupDistribution(count, sides) {
  // dp[sum] = 組み合わせ数
  let dp = new Map([[0, 1]]);

  for (let i = 0; i < count; i++) {
    const next = new Map();
    for (const [sum, ways] of dp) {
      for (let face = 1; face <= sides; face++) {
        const newSum = sum + face;
        next.set(newSum, (next.get(newSum) ?? 0) + ways);
      }
    }
    dp = next;
  }

  const totalWays = Math.pow(sides, count);
  return [...dp.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, ways]) => ({ value, probability: ways / totalWays }));
}

/**
 * 単一グループ向けのバイアス（buff/debuff）付き確率分布。
 * 既存の /dice buff / debuff オプションの互換維持用。
 *
 * @param {number} sides
 * @param {number} buff 0-100
 * @param {number} debuff 0-100
 * @returns {Array<{ face: number, probability: number }>}
 */
export function calculateBiasedFaceOdds(sides, buff = 0, debuff = 0) {
  const weights = [];
  for (let face = 1; face <= sides; face++) {
    const buffWeight = sides > 1 ? 1 + ((buff / 100) * (face - 1)) / (sides - 1) : 1;
    const debuffWeight = sides > 1 ? 1 + ((debuff / 100) * (sides - face)) / (sides - 1) : 1;
    weights.push(buffWeight * debuffWeight);
  }
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w, i) => ({ face: i + 1, probability: w / total }));
}

/**
 * バイアス付き重みから実際に1つの出目を抽選する。
 * Engine側ではなくbuff/debuff専用の後処理として dice.js アダプタから呼ばれる。
 */
export function weightedRandomFace(sides, normalizedWeights) {
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < sides; i++) {
    cumulative += normalizedWeights[i];
    if (rand < cumulative) return i + 1;
  }
  return sides;
}
