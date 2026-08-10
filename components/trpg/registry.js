/**
 * TRPG System Registry
 * ------------------------------------------------------------
 * 責務: 対応TRPGシステムの一覧管理だけ。
 * 判定ロジック自体は各Rule Component（coc7.js / dnd5e.js等）に持たせる。
 *
 * 新しいシステム（sw25 / dx3 等）を追加する場合の手順:
 *   1. components/trpg/<system>.js を作成し perform<System>Check() を実装
 *   2. このファイルへ import して TRPG_SYSTEMS に1エントリ追加
 *   3. data/jsons/lang/{ja,en}.json へ trpg.<system>.* キーを追加
 *   4. commands/dice.js の trpg system choice に追加
 * Dice Engine（components/dice/engine.js）自体は変更不要。
 */
import { performCoc7Check } from "./coc7.js";
import { performCoc6Check } from "./coc6.js";
import { performDnd5eCheck } from "./dnd5e.js";
import { validateCoc7Params, validateCoc6Params, validateDnd5eParams } from "./validator.js";

export const TRPG_SYSTEMS = {
  coc7: {
    id: "coc7",
    label: "Call of Cthulhu 7th", // Slash Choice表示名（内部IDとは分離）
    validate: validateCoc7Params,
    perform: performCoc7Check,
  },
  coc6: {
    id: "coc6",
    label: "Call of Cthulhu 6th",
    validate: validateCoc6Params,
    perform: performCoc6Check,
  },
  dnd5e: {
    id: "dnd5e",
    label: "Dungeons & Dragons 5e",
    validate: validateDnd5eParams,
    perform: performDnd5eCheck,
  },
};

export function getTrpgSystem(systemId) {
  return TRPG_SYSTEMS[systemId] ?? null;
}

export function isKnownTrpgSystem(systemId) {
  return Object.prototype.hasOwnProperty.call(TRPG_SYSTEMS, systemId);
}

/**
 * discord.js の addChoices() へそのまま渡せる形式で一覧を返す。
 */
export function listTrpgSystemChoices() {
  return Object.values(TRPG_SYSTEMS).map((s) => ({ name: s.label, value: s.id }));
}
