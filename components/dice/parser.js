/**
 * Dice Expression Parser
 * ------------------------------------------------------------
 * 責務: 文字列 → 構造化された Dice Expression (terms[]) への変換のみ。
 * 乱数生成・検証・表示は一切行わない（Validator / Engine / Formatter の責務）。
 *
 * 対応構文:
 *   NdM        ダイスグループ (例: 2d6)
 *   数値       固定値 (例: 5, -3)
 *   +  -       演算子（加算・減算のみ。四則演算・括弧・比較は非対応）
 *
 * 例:
 *   "2d6-1d4+3d8-4"
 *   → {
 *       terms: [
 *         { type: "dice",   operator: "+", count: 2, sides: 6 },
 *         { type: "dice",   operator: "-", count: 1, sides: 4 },
 *         { type: "dice",   operator: "+", count: 3, sides: 8 },
 *         { type: "number", operator: "-", value: 4 },
 *       ],
 *     }
 *
 * 将来 keep-highest / reroll / explode / comparison 等を追加する場合は
 * term オブジェクトへプロパティを追加する形で拡張できる。
 */

// トークン形式: 符号 + (数値d数値 または 数値)
const TERM_PATTERN = /^([+-]?)(\d+d\d+|\d+)$/i;

export const PARSE_ERROR = {
  EMPTY: "EMPTY_EXPRESSION",
  TOO_LONG: "EXPRESSION_TOO_LONG",
  INVALID_SYNTAX: "INVALID_EXPRESSION",
};

export class DiceParseError extends Error {
  constructor(code, detail = {}) {
    super(code);
    this.name = "DiceParseError";
    this.code = code;
    this.detail = detail;
  }
}

const MAX_EXPRESSION_LENGTH = 100;

/**
 * ダイス式文字列を terms[] へ変換する。
 * NFKC正規化・trimは呼び出し側（aspects/normalization.js）で行う前提。
 *
 * @param {string} expression 正規化済みのダイス式文字列 (例: "2d6+1d4-3")
 * @returns {{ expression: string, terms: Array }}
 * @throws {DiceParseError}
 */
export function parseDiceExpression(expression) {
  const raw = (expression ?? "").trim();

  if (raw.length === 0) {
    throw new DiceParseError(PARSE_ERROR.EMPTY);
  }
  if (raw.length > MAX_EXPRESSION_LENGTH) {
    throw new DiceParseError(PARSE_ERROR.TOO_LONG, { max: MAX_EXPRESSION_LENGTH });
  }

  // 演算子の前後にスペースが入っていても許容するため除去
  const compact = raw.replace(/\s+/g, "");

  // 先頭の符号を明示的な"+"として補完してからトークン分割する
  const withLeadingSign = /^[+-]/.test(compact) ? compact : `+${compact}`;

  // "+2d6-1d4+3" → ["+2d6", "-1d4", "+3"]
  const tokens = withLeadingSign.match(/[+-][^+-]+/g);

  // トークン分割で式全体を消費できていない場合は構文エラー
  // （例: "2d6++1d4" や "2dd6" など）
  if (!tokens || tokens.join("") !== withLeadingSign) {
    throw new DiceParseError(PARSE_ERROR.INVALID_SYNTAX, { expression: raw });
  }

  const terms = [];

  for (const token of tokens) {
    const operator = token[0] === "-" ? "-" : "+";
    const body = token.slice(1);

    const match = body.match(TERM_PATTERN);
    if (!match) {
      throw new DiceParseError(PARSE_ERROR.INVALID_SYNTAX, { expression: raw, token });
    }

    if (body.includes("d")) {
      const [countStr, sidesStr] = body.split(/d/i);

      // "d6" (countなし) や "2d" (sidesなし) は正規表現側で弾かれるが、念のため二重チェック
      if (countStr === "" || sidesStr === "") {
        throw new DiceParseError(PARSE_ERROR.INVALID_SYNTAX, { expression: raw, token });
      }

      terms.push({
        type: "dice",
        operator,
        count: Number(countStr),
        sides: Number(sidesStr),
      });
    } else {
      terms.push({
        type: "number",
        operator,
        value: Number(body),
      });
    }
  }

  return { expression: raw, terms };
}
