/**
 * Input Normalization Aspect
 * ------------------------------------------------------------
 * 責務: ユーザー入力文字列の正規化だけ。ダイス解析やDiscord処理は行わない。
 *
 * スマートフォンの全角入力（IME）対策として、Unicode正規化(NFKC)で
 * 全角英数記号を半角へ統一する。個別の正規表現を大量に書かない方針。
 *
 * 例:
 *   "２ｄ６＋１ｄ４" → "2d6+1d4"
 *   "ｒ！２ｄ６"     → "r!2d6"
 */
export function normalizeInput(input) {
  if (typeof input !== "string") return "";
  return input.normalize("NFKC").trim();
}

/**
 * Prefix判定用に、正規化した上で英字を小文字化する。
 */
export function normalizeForPrefix(input) {
  return normalizeInput(input).toLowerCase();
}
