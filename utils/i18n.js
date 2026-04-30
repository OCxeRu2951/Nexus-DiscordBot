import { db } from "./db.js";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJson(lang) {
  try {
    const raw = readFileSync(
      join(__dirname, `../data/jsons/lang/${lang}.json`),
      "utf-8",
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const translations = {
  ja: loadJson("ja"),
  en: loadJson("en"),
};

export function t(lang, key, vars = {}) {
  const keys = key.split(".");
  let result = translations[lang] ?? translations["ja"];

  for (const k of keys) {
    result = result?.[k];
    if (result === undefined) return key;
  }

  if (typeof result !== "string") return key;

  return result.replace(/\{(\w+)\}/g, (_, k) => {
    return vars[k] !== undefined ? String(vars[k]) : `{${k}}`;
  });
}

export async function getLang(guildId) {
  try {
    const { rows } = await db.execute({
      sql: `SELECT lang FROM guild_lang WHERE guild_id = ?`,
      args: [guildId],
    });
    return rows[0]?.lang ?? "ja";
  } catch {
    return "ja";
  }
}
