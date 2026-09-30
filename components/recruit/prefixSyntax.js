/**
 * Recruit Prefix Syntax Parser
 * ------------------------------------------------------------
 * 責務: b! 以降の本文を募集パラメータへ変換するだけ。Discord/DBには依存しない。
 *
 * 構文:
 *   b!<タイトル> [@人数] [締切]
 *   <2行目以降は詳細（description）>
 *
 *   - @人数 : "@3" / "＠３" / "@3人"                       → capacity
 *   - 締切  : "30m" / "30min" / "30分" / "2h" / "2時間"    → duration（分）
 *   - スレッドを作らない: "スレなし" / "スレッドなし" / "nothread" → thread: false
 *   - いずれも1行目の「独立したトークン」の場合のみ認識する（位置は自由）。
 *     "30分だけ" のように語の一部になっているものはタイトル扱い。
 *   - 全角入力はトークン単位でNFKC正規化して判定する。タイトル自体は元の文字列のまま。
 *   - メンション（<@id> / <@&id> / <#id> / @everyone / @here）はタイトルから除外する
 *     （Embedのタイトルではメンションが表示されないため）。
 *
 * 例:
 *   "ボドゲ会 @3 60分"          → { title: "ボドゲ会", capacity: 3, duration: 60 }
 *   "APEX ランク @2 1h\n21時〜" → { title: "APEX ランク", capacity: 2, duration: 60, description: "21時〜" }
 */

export const RECRUIT_LIMITS = {
  titleMax:       100,
  descriptionMax: 1000,
  capacityMin:    1,
  capacityMax:    50,
  durationMin:    1,
  durationMax:    10080, // 7日
};

const CAPACITY_RE = /^@(\d+)人?$/;
const MINUTES_RE  = /^(\d+)(?:m|min|分)$/;
const HOURS_RE    = /^(\d+)(?:h|hr|時間)$/;
const MENTION_RE  = /^(?:<(?:@[!&]?|#)\d+>|@everyone|@here)$/;
const NO_THREAD_RE = /^(?:nothread|no-thread|スレなし|スレッドなし)$/;

/**
 * @param {string} body "b!" を除いた後の本文（元の文字列、trim済み想定）
 * @returns {{ ok: true, title: string, description: string|null, capacity: number|null, duration: number|null, thread: boolean }
 *         | { ok: false, error: string, vars?: object }}
 */
export function parseRecruitPrefix(body) {
  const text = (body ?? "").trim();
  if (!text) return { ok: false, error: "prefix_usage" };

  const [header, ...rest] = text.split(/\r?\n/);
  const description = rest.join("\n").trim() || null;

  let capacity = null;
  let duration = null;
  let thread   = true;
  const titleTokens = [];

  for (const token of header.split(/\s+/).filter(Boolean)) {
    const n = token.normalize("NFKC").toLowerCase();
    let m;

    if ((m = n.match(CAPACITY_RE))) { capacity = Number(m[1]); continue; }
    if ((m = n.match(MINUTES_RE)))  { duration = Number(m[1]); continue; }
    if ((m = n.match(HOURS_RE)))    { duration = Number(m[1]) * 60; continue; }
    if (NO_THREAD_RE.test(n))        { thread = false; continue; }
    if (MENTION_RE.test(n)) continue;

    titleTokens.push(token);
  }

  const title = titleTokens.join(" ");
  const L = RECRUIT_LIMITS;

  if (!title) return { ok: false, error: "prefix_usage" };

  if (title.length > L.titleMax) {
    return { ok: false, error: "error_title_length", vars: { max: L.titleMax } };
  }
  if (description && description.length > L.descriptionMax) {
    return { ok: false, error: "error_description_length", vars: { max: L.descriptionMax } };
  }
  if (capacity !== null && (capacity < L.capacityMin || capacity > L.capacityMax)) {
    return { ok: false, error: "error_capacity_range", vars: { min: L.capacityMin, max: L.capacityMax } };
  }
  if (duration !== null && (duration < L.durationMin || duration > L.durationMax)) {
    return { ok: false, error: "error_duration_range", vars: { min: L.durationMin, max: L.durationMax } };
  }

  return { ok: true, title, description, capacity, duration, thread };
}
