/**
 * TRPG Prefix Shorthand Parser
 * ------------------------------------------------------------
 * 責務: Prefix Adapter (d!) 向けのTRPG短縮構文を
 * { system, params } へ変換するだけ。Discord/DBには依存しない。
 *
 * 対応構文:
 *   coc7 <target>              例: "coc7 60"
 *   coc6 <target>              例: "coc6 60"
 *   dnd <modifier> [adv|dis]   例: "dnd +5", "dnd +5 adv", "dnd +5 dis"
 *
 * "coc" ではなく "coc6" / "coc7" を採用した理由:
 *   クトゥルフ神話TRPGには第6版と第7版でルール・閾値が異なるため、
 *   曖昧な "coc" ではなくバージョンを明示する識別子にした。
 *
 * 既存の汎用ダイス式 (2d6+1d4-3 等) は先頭トークンが数字/dで始まるため、
 * 先頭トークンが登録済みTRPGキーワードの場合のみTRPG構文として解釈する。
 * それ以外は null を返し、呼び出し側は既存の Dice Parser へフォールバックする
 * （＝既存のd!2d6等の挙動は一切変更しない）。
 *
 * 新システム追加時: SHORTHAND_TO_SYSTEM へ1エントリ追加するだけでよい。
 * 百分率ダイス系（target指定のみ）なら COC_LIKE_SYSTEM_IDS にも追加する。
 */

const SHORTHAND_TO_SYSTEM = { coc7: "coc7", coc6: "coc6", dnd: "dnd5e" };

// target指定だけで成立する百分率ダイス系システム（CoC系列）
const COC_LIKE_SYSTEM_IDS = new Set(["coc7", "coc6"]);

const MODE_ALIASES = {
  adv: "advantage",
  advantage: "advantage",
  dis: "disadvantage",
  disadvantage: "disadvantage",
  normal: "normal",
};

/**
 * @param {string} body "d!" を除いた後の文字列（正規化・trim済み想定）
 * @returns {{ system: string, params: object } | null}
 */
export function parsePrefixTrpgShorthand(body) {
  const tokens = (body ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const keyword = tokens[0].toLowerCase();
  const systemId = SHORTHAND_TO_SYSTEM[keyword];
  if (!systemId) return null;

  if (COC_LIKE_SYSTEM_IDS.has(systemId)) {
    const target = Number.parseInt(tokens[1], 10);
    return {
      system: systemId,
      params: {
        target: Number.isNaN(target) ? NaN : target,
        bonusDice: 0,
        penaltyDice: 0,
      },
    };
  }

  // dnd5e
  const modifier = Number.parseInt(tokens[1], 10);
  const modeToken = tokens[2]?.toLowerCase();
  const mode = MODE_ALIASES[modeToken] ?? "normal";

  return {
    system: systemId,
    params: {
      modifier: Number.isNaN(modifier) ? 0 : modifier,
      mode,
      target: null,
    },
  };
}
