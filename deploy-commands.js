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

// カンマ区切りで複数ギルドIDに対応
const guildIds = process.env.GUILD_ID.split(",").map((id) => id.trim());

try {
  console.log(
    `Registering ${commands.length} slash commands to ${guildIds.length} guild(s)...`,
  );

  for (const guildId of guildIds) {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
      { body: commands },
    );
    console.log(`Registered to guild: ${guildId}`);
  }

  console.log("Done.");
} catch (err) {
  console.error(err);
}
