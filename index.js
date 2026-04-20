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
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

client.login(process.env.DISCORD_TOKEN);
