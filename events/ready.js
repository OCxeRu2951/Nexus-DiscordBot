import { EmbedBuilder } from "discord.js";
import { db } from "../utils/db.js";
import { schedulePollEnd } from "../commands/poll.js";
import { registerGuild } from "./guildCreate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  name: "clientReady",
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    await registerExistingGuilds(client);
    await restoreReminders(client);
    await restorePolls(client);
    await cleanupExpiredData(client);
    setInterval(() => cleanupExpiredData(client), 60 * 60 * 1000);
    scheduleHourlyAnnouncement(client);
  },
};

async function loadSetting(guildId) {
  const { rows } = await db
    .execute({
      sql: `SELECT * FROM guild_settings WHERE guild_id = ?`,
      args: [guildId],
    })
    .catch(() => ({ rows: [] }));

  return {
    afk_hours: rows[0]?.afk_hours ?? 24,
    poll_days: rows[0]?.poll_days ?? 7,
    warnings_days: rows[0]?.warnings_days ?? 90,
    application_days: rows[0]?.application_days ?? 90,
  };
}

// クリーンアップ

async function cleanupExpiredData(client) {
  for (const [guildId] of client.guilds.cache) {
    const config = await loadSetting(guildId);
    const now = Date.now();
    const expireThreshold = now - config.afk_hours * 60 * 60 * 1000;

    // AFKのクリーンアップ（ギルドごと）
    const { rows: expiredAfk } = await db
      .execute({
        sql: `SELECT * FROM afk WHERE user_id IN (
              SELECT user_id FROM afk
              LIMIT -1 OFFSET 0
            ) AND since < ?`,
        args: [expireThreshold],
      })
      .catch(() => ({ rows: [] }));

    for (const row of expiredAfk) {
      const user = await client.users.fetch(row.user_id).catch(() => null);
      if (user) {
        await user
          .send(
            `AFKを設定してから **${config.afk_hours}時間** が経過したため、自動的に解除しました。\n理由: ${row.reason}`,
          )
          .catch(() => {});
      }
    }

    await db
      .execute({
        sql: `DELETE FROM afk WHERE since < ?`,
        args: [expireThreshold],
      })
      .catch(console.error);

    await db
      .execute({
        sql: `DELETE FROM polls WHERE guild_id = ? AND end_at IS NOT NULL AND end_at < ?`,
        args: [guildId, now - config.poll_days * 24 * 60 * 60 * 1000],
      })
      .catch(console.error);

    if (config.warnings_days) {
      await db
        .execute({
          sql: `DELETE FROM warnings WHERE guild_id = ? AND issued_at < ?`,
          args: [guildId, now - config.warnings_days * 24 * 60 * 60 * 1000],
        })
        .catch(console.error);
    }

    if (config.application_days) {
      await db
        .execute({
          sql: `DELETE FROM applications WHERE guild_id = ? AND created_at < ?`,
          args: [guildId, now - config.application_days * 24 * 60 * 60 * 1000],
        })
        .catch(console.error);
    }
  }

  console.log("Cleanup completed.");
}

// 既存ギルド一括登録

async function registerExistingGuilds(client) {
  let count = 0;
  for (const [guildId] of client.guilds.cache) {
    await registerGuild(guildId);
    count++;
  }
  console.log(`Registered ${count} existing guild(s).`);
}

// リマインダーキャンセル通知

async function restoreReminders(client) {
  try {
    const { rows } = await db.execute(
      `SELECT * FROM reminders WHERE fire_at > ?`,
      [Date.now()],
    );

    for (const row of rows) {
      try {
        const user = await client.users.fetch(row.user_id).catch(() => null);
        if (user) {
          await user
            .send(
              `Bot再起動により **${row.label}** のタイマーがキャンセルされました。再度設定してください。`,
            )
            .catch(() => {});
        }
      } catch (err) {
        console.error("Failed to notify reminder cancellation:", err);
      }
    }

    await db.execute(`DELETE FROM reminders WHERE fire_at > ?`, [Date.now()]);

    if (rows.length > 0)
      console.log(`Cancelled ${rows.length} reminder(s) and notified users.`);
  } catch (err) {
    console.error("Failed to process reminders on restart:", err);
  }
}

// 投票復元

async function restorePolls(client) {
  try {
    const { rows } = await db.execute(
      `SELECT * FROM polls WHERE end_at IS NOT NULL AND end_at > ?`,
      [Date.now()],
    );
    for (const row of rows) {
      schedulePollEnd(client, row);
    }
    if (rows.length > 0) console.log(`Restored ${rows.length} poll(s).`);
  } catch (err) {
    console.error("Failed to restore polls:", err);
  }
}

async function cleanupExpiredData(client) {
  const config = loadSetting();
  const now = Date.now();
  const expireThreshold = now - config.afk_hours * 60 * 60 * 1000;

  // AFK期限切れユーザーにDM通知してから削除
  const { rows: expiredAfk } = await db
    .execute({
      sql: `SELECT * FROM afk WHERE since < ?`,
      args: [expireThreshold],
    })
    .catch(() => ({ rows: [] }));

  for (const row of expiredAfk) {
    try {
      const user = await client.users.fetch(row.user_id).catch(() => null);
      if (user) {
        await user
          .send(
            `AFKを設定してから **${config.afk_hours}時間** が経過したため、自動的に解除しました。\n理由: ${row.reason}`,
          )
          .catch(() => {});
      }
    } catch (err) {
      console.error("Failed to notify AFK expiry:", err);
    }
  }

  await db
    .execute({
      sql: `DELETE FROM afk WHERE since < ?`,
      args: [expireThreshold],
    })
    .catch(console.error);

  await db
    .execute({
      sql: `DELETE FROM polls WHERE end_at IS NOT NULL AND end_at < ?`,
      args: [now - config.poll_days * 24 * 60 * 60 * 1000],
    })
    .catch(console.error);

  if (config.warnings_days) {
    await db
      .execute({
        sql: `DELETE FROM warnings WHERE issued_at < ?`,
        args: [now - config.warnings_days * 24 * 60 * 60 * 1000],
      })
      .catch(console.error);
  }

  if (config.application_days) {
    await db
      .execute({
        sql: `DELETE FROM applications WHERE created_at < ?`,
        args: [now - config.application_days * 24 * 60 * 60 * 1000],
      })
      .catch(console.error);
  }

  console.log("Cleanup completed.");
}

// 時報

async function getHourlyPayload(guildId, hour, minute) {
  const { rows: exactRows } = await db
    .execute({
      sql: `SELECT * FROM hourly_messages WHERE guild_id = ? AND hour = ? AND enabled = 1`,
      args: [guildId, hour],
    })
    .catch(() => ({ rows: [] }));

  const { rows: defaultRows } = await db
    .execute({
      sql: `SELECT * FROM hourly_messages WHERE guild_id = ? AND hour = -1 AND enabled = 1`,
      args: [guildId],
    })
    .catch(() => ({ rows: [] }));

  const entry = exactRows[0] ?? defaultRows[0] ?? null;
  if (!entry) return null;

  const payload = {};

  if (entry.content) {
    payload.content = replacePlaceholders(entry.content, hour, minute);
  }

  if (entry.embed) {
    try {
      const embedData = JSON.parse(entry.embed);
      const embed = new EmbedBuilder();
      if (embedData.title)
        embed.setTitle(replacePlaceholders(embedData.title, hour, minute));
      if (embedData.description)
        embed.setDescription(
          replacePlaceholders(embedData.description, hour, minute),
        );
      if (embedData.color) embed.setColor(embedData.color);
      if (embedData.footer)
        embed.setFooter({
          text: replacePlaceholders(embedData.footer, hour, minute),
        });
      if (embedData.image) embed.setImage(embedData.image);
      if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
      payload.embeds = [embed];
    } catch (err) {
      console.error("Failed to parse embed JSON:", err);
    }
  }

  if (entry.image_url && !entry.embed) {
    payload.embeds = [new EmbedBuilder().setImage(entry.image_url)];
  }

  if (entry.file_url) {
    try {
      const res = await fetch(entry.file_url);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const fileName = entry.file_url.split("/").pop().split("?")[0];
        payload.files = [{ attachment: buffer, name: fileName }];
      } else {
        console.warn(`Failed to fetch file: ${entry.file_url}`);
      }
    } catch (err) {
      console.error("Failed to attach file:", err);
    }
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

async function sendHourlyAnnouncement(client) {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const hour = jst.getHours();
  const minute = jst.getMinutes();

  for (const [guildId] of client.guilds.cache) {
    const { rows } = await db
      .execute({
        sql: `SELECT hourly_channel_id FROM settings WHERE guild_id = ?`,
        args: [guildId],
      })
      .catch(() => ({ rows: [] }));

    if (!rows.length || !rows[0].hourly_channel_id) continue;

    const channel = client.channels.cache.get(rows[0].hourly_channel_id);
    if (!channel) continue;

    const payload = await getHourlyPayload(guildId, hour, minute);
    if (!payload) continue;

    await channel.send(payload).catch(console.error);
  }
}

function scheduleHourlyAnnouncement(client) {
  const now = new Date();
  const msUntilNextHour =
    (60 - now.getMinutes()) * 60 * 1000 -
    now.getSeconds() * 1000 -
    now.getMilliseconds();

  setTimeout(() => {
    sendHourlyAnnouncement(client);
    setInterval(() => sendHourlyAnnouncement(client), 60 * 60 * 1000);
  }, msUntilNextHour);
}

function replacePlaceholders(str, hour, minute) {
  if (!str) return str;
  return str
    .replace(/{hour}/g, String(hour).padStart(2, "0"))
    .replace(/{minute}/g, String(minute).padStart(2, "0"));
}

async function sendHourlyAnnouncement(client) {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const hour = jst.getHours();
  const minute = jst.getMinutes();

  for (const [guildId] of client.guilds.cache) {
    const { rows } = await db
      .execute({
        sql: `SELECT hourly_channel_id FROM settings WHERE guild_id = ?`,
        args: [guildId],
      })
      .catch(() => ({ rows: [] }));

    if (!rows.length || !rows[0].hourly_channel_id) continue;

    const channel = client.channels.cache.get(rows[0].hourly_channel_id);
    if (!channel) continue;

    // guildIdごとにDBから取得
    const payload = await getHourlyPayload(guildId, hour, minute);
    if (!payload) continue;

    await channel.send(payload).catch(console.error);
  }
}
