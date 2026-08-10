/**
 * Dice Engine
 * ------------------------------------------------------------
 * 責務: 検証済み Dice Expression (terms[]) を実際に振り、計算するだけ。
 * Discordには一切依存しない（interaction.reply / message.reply を呼ばない）。
 * 表示整形は formatter.js の責務。
 *
 * TRPGルール側（coc7 / dnd5e 等、components/trpg/ 配下）はこの
 * rollDie() / rollExpression() をそのまま再利用する。
 * Engine内にシステム固有の分岐は入れない（Fair Rollerのまま維持する）。
 *
 * rng引数はテスト時に固定乱数を注入できるようにするためのもの。
 * 省略時は Math.random を使う（既存の挙動を変えない）。
 */

/**
 * @param {number} sides
 * @param {() => number} rng 0以上1未満の乱数を返す関数（省略時 Math.random）
 */
export function rollDie(sides, rng = Math.random) {
  return Math.floor(rng() * sides) + 1;
}

/**
 * 1セット分、terms[] を実際に振って計算する。
 *
 * @param {{ expression: string, terms: Array }} parsed
 * @param {() => number} [rng] テスト用の乱数注入（省略時 Math.random）
 * @returns {{
 *   expression: string,
 *   terms: Array, // rolls / subtotal が付与された結果term
 *   total: number,
 * }}
 */
export function rollExpression(parsed, rng = Math.random) {
  const resultTerms = parsed.terms.map((term) => {
    if (term.type === "dice") {
      const rolls = Array.from({ length: term.count }, () => rollDie(term.sides, rng));
      const subtotal = rolls.reduce((a, b) => a + b, 0);
      return { ...term, rolls, subtotal };
    }
    // number term はそのまま（表示側で operator と value を使う）
    return { ...term };
  });

  const total = resultTerms.reduce((acc, term) => {
    const value = term.type === "dice" ? term.subtotal : term.value;
    return term.operator === "-" ? acc - value : acc + value;
  }, 0);

  return {
    expression: parsed.expression,
    terms: resultTerms,
    total,
  };
}

/**
 * 同じ式を複数セット独立して振る。
 *
 * @param {{ expression: string, terms: Array }} parsed
 * @param {number} sets
 * @param {() => number} [rng]
 * @returns {Array<ReturnType<typeof rollExpression>>}
 */
export function rollExpressionSets(parsed, sets = 1, rng = Math.random) {
  return Array.from({ length: sets }, () => rollExpression(parsed, rng));
}
