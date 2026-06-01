import "dotenv/config";
import { REST, Routes } from "discord.js";
import { readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 言語ファイルを同期読み込み
function loadJson(lang) {
  try {
    const raw = readFileSync(
      join(__dirname, `data/jsons/lang/${lang}.json`),
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

// ドット区切りキーの解決
function resolve(lang, key) {
  const keys = key.split(".");
  let result = translations[lang];
  for (const k of keys) {
    result = result?.[k];
    if (result === undefined) return null;
  }
  return typeof result === "string" ? result : null;
}

const commands = [];
const commandFiles = readdirSync(join(__dirname, "commands")).filter((f) =>
  f.endsWith(".js"),
);

for (const file of commandFiles) {
  const { default: command } = await import(`./commands/${file}`);
  const json = command.data.toJSON();
  const commandName = json.name;

  // description_localizationsを自動インジェクション
  const jaDesc = resolve("ja", `commands.${commandName}.description`);
  const enDesc = resolve("en", `commands.${commandName}.description`);

  if (jaDesc || enDesc) {
    json.description_localizations = {};
    if (jaDesc) json.description_localizations["ja"] = jaDesc;
    if (enDesc) json.description_localizations["en-US"] = enDesc;
    // description自体はenをベースにする（未設定の場合はそのまま）
    if (enDesc) json.description = enDesc;
  }

  commands.push(json);
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

try {
  console.log(`Registering ${commands.length} global slash commands...`);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
    body: commands,
  });
  console.log("Done. (反映まで最大1時間かかる場合があります)");
} catch (err) {
  console.error(err);
}
