import { db } from "../utils/db.js";

export default {
  name: "guildDelete",
  async execute(guild) {
    console.log(`Left guild: ${guild.name} (${guild.id})`);

    const tables = [
      "settings",
      "mod_settings",
      "apply_settings",
      "warnings",
      "mod_notes",
      "mod_logs",
      "polls",
      "applications",
      "reminders",
      "afk",
    ];

    for (const table of tables) {
      await db
        .execute({
          sql: `DELETE FROM ${table} WHERE guild_id = ?`,
          args: [guild.id],
        })
        .catch(console.error);
    }

    console.log(`Cleaned up data for guild: ${guild.id}`);
  },
};
