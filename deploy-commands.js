import "dotenv/config";
import { REST, Routes } from "discord.js";
import { readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const commands = [];
const commandFiles = readdirSync(join(__dirname, "commands")).filter((f) =>
  f.endsWith(".js"),
);

for (const file of commandFiles) {
  const { default: command } = await import(`./commands/${file}`);
  commands.push(command.data.toJSON());
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
