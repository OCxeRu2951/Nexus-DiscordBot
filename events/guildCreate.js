import { db } from "../utils/db.js";
import { cancelGuildDeletion } from "../utils/guildCleanup.js";

async function registerGuild(guildId) {
  await db
    .batch(
      [
        {
          sql: `INSERT OR IGNORE INTO settings (guild_id) VALUES (?)`,
          args: [guildId],
        },
        {
          sql: `INSERT OR IGNORE INTO mod_settings (guild_id) VALUES (?)`,
          args: [guildId],
        },
        {
          sql: `INSERT OR IGNORE INTO apply_settings (guild_id) VALUES (?)`,
          args: [guildId],
        },
      ],
      "write",
    )
    .catch(console.error);
}

export default {
  name: "guildCreate",
  async execute(guild) {
    console.log(`Joined guild: ${guild.name} (${guild.id})`);
    await registerGuild(guild.id);

    // 削除猶予期間中の再参加であれば予約をキャンセルする
    await cancelGuildDeletion(guild.id);

    console.log(`Registered guild: ${guild.id}`);
  },
};

export { registerGuild };
