import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { db } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 対応言語一覧（将来 ko / zh-CN / de 等を追加する場合はここに追記するだけでよい）
export const SUPPORTED_LANGUAGES = ["en", "ja"];

// 最終フォールバック言語
const DEFAULT_LANGUAGE = "en";

function loadJson(lang) {
  try {
    const raw = readFileSync(
      join(__dirname, `../data/jsons/lang/${lang}.json`),
      "utf-8",
    );
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[i18n] Failed to load language file: ${lang}`, error);
    return null;
  }
}

const translations = {};
for (const lang of SUPPORTED_LANGUAGES) {
  translations[lang] = loadJson(lang);
}

// ドット区切りキーを解決する（見つからなければ undefined）
function resolveKey(table, key) {
  if (!table) return undefined;
  const parts = key.split(".");
  let result = table;
  for (const part of parts) {
    result = result?.[part];
    if (result === undefined) return undefined;
  }
  return typeof result === "string" ? result : undefined;
}

/**
 * 翻訳文字列を取得する。
 *
 * フォールバック順序:
 *   1. 指定言語 (lang)
 *   2. 英語 (en)
 *   3. キー文字列そのもの
 */
export function t(lang, key, vars = {}) {
  let result = resolveKey(translations[lang], key);

  if (result === undefined && lang !== DEFAULT_LANGUAGE) {
    result = resolveKey(translations[DEFAULT_LANGUAGE], key);
  }

  if (result === undefined) {
    return key;
  }

  return result.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
  );
}

/**
 * Discordのlocale文字列 (ja, en-US, en-GB 等) をサポート言語コードへ正規化する。
 * 対応していない場合は null を返す。
 */
export function normalizeLocale(locale) {
  if (!locale) return null;
  for (const lang of SUPPORTED_LANGUAGES) {
    if (locale.startsWith(lang)) return lang;
  }
  return null;
}

// ============================================================
// ユーザー単位の言語設定
// ============================================================

/**
 * ユーザーが手動設定した言語を取得する。
 * 未設定（Auto）の場合は null。
 */
export async function getUserLang(userId) {
  if (!userId) return null;
  try {
    const { rows } = await db.execute({
      sql: `SELECT lang FROM user_lang WHERE user_id = ?`,
      args: [userId],
    });
    return rows[0]?.lang ?? null;
  } catch (error) {
    console.error("[i18n] Failed to get user language:", error);
    return null;
  }
}

export async function setUserLang(userId, lang) {
  await db.execute({
    sql: `INSERT INTO user_lang (user_id, lang) VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET lang = ?`,
    args: [userId, lang, lang],
  });
}

// Auto化: レコードを削除することで「未設定」を表す
export async function clearUserLang(userId) {
  await db.execute({
    sql: `DELETE FROM user_lang WHERE user_id = ?`,
    args: [userId],
  });
}

// ============================================================
// サーバー単位の言語設定
// ============================================================

/**
 * サーバーが手動設定したデフォルト言語を取得する。
 * 未設定（Auto）の場合は null。
 */
export async function getGuildLang(guildId) {
  if (!guildId) return null;
  try {
    const { rows } = await db.execute({
      sql: `SELECT lang FROM guild_lang WHERE guild_id = ?`,
      args: [guildId],
    });
    return rows[0]?.lang ?? null;
  } catch (error) {
    console.error("[i18n] Failed to get guild language:", error);
    return null;
  }
}

export async function setGuildLang(guildId, lang) {
  await db.execute({
    sql: `INSERT INTO guild_lang (guild_id, lang) VALUES (?, ?)
          ON CONFLICT(guild_id) DO UPDATE SET lang = ?`,
    args: [guildId, lang, lang],
  });
}

// Auto化: レコードを削除することで「未設定」を表す
export async function clearGuildLang(guildId) {
  await db.execute({
    sql: `DELETE FROM guild_lang WHERE guild_id = ?`,
    args: [guildId],
  });
}

// ============================================================
// 言語Resolver（優先順位ロジックの本体）
// ============================================================

/**
 * 優先順位:
 *   1. ユーザーが手動設定した言語
 *   2. サーバーが手動設定したデフォルト言語
 *   3. Discordの interaction.locale
 *   4. 最終フォールバックとして英語(en)
 *
 * interactionを直接持たない呼び出し元（DM通知など）のために、
 * userId / guildId / locale を個別に渡せる形にしている。
 */
export async function resolveLang({ userId = null, guildId = null, locale = null } = {}) {
  // 1. ユーザー手動設定
  const userLang = await getUserLang(userId);
  if (userLang) return userLang;

  // 2. サーバー手動設定（DMの場合はguildIdがnullなのでスキップされる）
  if (guildId) {
    const guildLang = await getGuildLang(guildId);
    if (guildLang) return guildLang;
  }

  // 3. Discordのlocale
  const localeLang = normalizeLocale(locale);
  if (localeLang) return localeLang;

  // 4. 最終フォールバック
  return DEFAULT_LANGUAGE;
}

/**
 * interactionから直接言語を解決する。
 * 各コマンド/イベントはこの関数だけを呼べばよく、
 * ユーザー設定・サーバー設定・Discord localeのどれが使われたかを
 * 意識する必要はない。
 */
export async function getLang(interaction) {
  return resolveLang({
    userId: interaction?.user?.id ?? null,
    guildId: interaction?.guildId ?? null,
    locale: interaction?.locale ?? null,
  });
}
