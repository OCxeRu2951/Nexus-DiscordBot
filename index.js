import "dotenv/config";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import { readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initDb } from "./utils/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  // AFK の理由や申請内容など、利用者が書いた文に @everyone やロールが含まれていても通知しない。
  // ロール等を鳴らす投稿（募集・時報）は送信時に個別に指定する
  allowedMentions: { parse: ["users"], repliedUser: true },
});

// DB初期化
await initDb();
console.log("Database initialized.");

// コマンドをコレクションに登録
client.commands = new Collection();
const commandFiles = readdirSync(join(__dirname, "commands")).filter((f) =>
  f.endsWith(".js"),
);
for (const file of commandFiles) {
  const { default: command } = await import(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// イベントを登録
const eventFiles = readdirSync(join(__dirname, "events")).filter((f) =>
  f.endsWith(".js"),
);
for (const file of eventFiles) {
  const { default: event } = await import(`./events/${file}`);
  // 1件の処理の失敗（権限不足で返信できない、DBの一時障害など）でプロセスごと落ちないよう、ここで受け止める
  const run = (...args) =>
    Promise.resolve()
      .then(() => event.execute(...args, client))
      .catch((err) => console.error(`[event:${event.name}]`, err));
  if (event.once) {
    client.once(event.name, run);
  } else {
    client.on(event.name, run);
  }
}

// error リスナーが無いと、discord.js が emit した error でプロセスが終了する
client.on("error", (err) => console.error("[client]", err));
// タイマー等から呼ばれる非同期処理の失敗もログに残して動作を続ける
process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));

// ログインできない場合は従来どおり終了させ、PM2 の再起動とログで気付けるようにする
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("[login]", err);
  process.exit(1);
});
