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
 *   "ｄ！２ｄ６"     → "d!2d6"
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

/**
 * メッセージ先頭のPrefixを 全角/半角・大文字/小文字 を問わず判定する。
 *
 * Prefix部分だけを1文字ずつ NFKC + 小文字化して比較し、本文は
 * 「元の文字列」から切り出して返す。本文の大文字小文字や全角文字は
 * 変更しないため、申請内容のような自由記述をそのまま扱える。
 *
 * 例（prefixes = ["a!", "r!", "d!"]）:
 *   "a!参加希望です"   → { prefix: "a!", body: "参加希望です" }
 *   "Ａ！ 参加希望です" → { prefix: "a!", body: "参加希望です" }
 *   "ｄ！２ｄ６"        → { prefix: "d!", body: "２ｄ６" }
 *   "hello"             → null
 *
 * @param {string}   input    メッセージ本文
 * @param {string[]} prefixes 小文字・半角で記述したPrefix一覧
 * @returns {{ prefix: string, body: string } | null}
 */
export function matchPrefix(input, prefixes) {
  if (typeof input !== "string") return null;
  const source = input.trim();

  for (const prefix of prefixes) {
    let normalized = "";
    let consumed   = 0;

    // for...of はコードポイント単位で走査する（サロゲートペアを分断しない）
    for (const ch of source) {
      if (normalized.length >= prefix.length) break;
      normalized += ch.normalize("NFKC").toLowerCase();
      consumed   += ch.length;
    }

    if (normalized === prefix) {
      return { prefix, body: source.slice(consumed).trim() };
    }
  }

  return null;
}
