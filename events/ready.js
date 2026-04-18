import { db } from "../utils/db.js";
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { schedulePollEnd } from "../commands/poll.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  name: "clientReady",
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    await restoreReminders(client);
    await restorePolls(client);
    await cleanupExpiredData(client);
    setInterval(() => cleanupExpiredData(client), 60 * 60 * 1000);
    scheduleHourlyAnnouncement(client);
  },
};

// ---- リマインダーキャンセル通知 ----

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

// ---- 投票復元 ----

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

// ---- クリーンアップ ----

function loadSetting() {
  try {
    const raw = readFileSync(
      join(__dirname, "../data/jsons/setting.json"),
      "utf-8",
    );
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Failed to load setting.json, using defaults:", err.message);
    return { afk_hours: 24, poll_days: 7, warnings_days: 90 };
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

  console.log("Cleanup completed.");

  // applications: application_days日以上経過したものを削除
  if (config.application_days) {
    await db
      .execute({
        sql: `DELETE FROM applications WHERE created_at < ?`,
        args: [now - config.application_days * 24 * 60 * 60 * 1000],
      })
      .catch(console.error);
  }
}

// ---- 時報 ----

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

function buildPayload(entry, hour, minute) {
  const payload = {};

  if (entry.content) {
    payload.content = replacePlaceholders(entry.content, hour, minute);
  }

  if (entry.embed) {
    const embed = new EmbedBuilder();
    if (entry.embed.title)
      embed.setTitle(replacePlaceholders(entry.embed.title, hour, minute));
    if (entry.embed.description)
      embed.setDescription(
        replacePlaceholders(entry.embed.description, hour, minute),
      );
    if (entry.embed.color) embed.setColor(entry.embed.color);
    if (entry.embed.footer)
      embed.setFooter({
        text: replacePlaceholders(entry.embed.footer, hour, minute),
      });
    if (entry.embed.image) embed.setImage(entry.embed.image);
    if (entry.embed.thumbnail) embed.setThumbnail(entry.embed.thumbnail);
    payload.embeds = [embed];
  }

  if (entry.image && !entry.embed) {
    const embed = new EmbedBuilder().setImage(entry.image);
    payload.embeds = [embed];
  }

  if (entry.file) {
    // 拡張子で格納先を判定
    const isAudio = entry.file.match(/\.(mp3|wav)$/i);
    const filePath = isAudio
      ? join(__dirname, "../data/other", entry.file)
      : join(__dirname, "../data/images", entry.file);

    if (existsSync(filePath)) {
      payload.files = [new AttachmentBuilder(filePath)];
    } else {
      console.warn(`Hourly file not found: ${filePath}`);
    }
  }

  return payload;
}

function getHourlyPayload(hour, minute) {
  try {
    const raw = readFileSync(
      join(__dirname, "../data/jsons/hourly.json"),
      "utf-8",
    );
    const { messages } = JSON.parse(raw);
    const entry = messages[String(hour)] ?? messages.default;

    if (!entry) return null;

    if (typeof entry === "string") {
      return { content: replacePlaceholders(entry, hour, minute) };
    }

    return buildPayload(entry, hour, minute);
  } catch (err) {
    console.error("Failed to load hourly.json:", err);
    return null;
  }
}

async function sendHourlyAnnouncement(client) {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const hour = jst.getHours();
  const minute = jst.getMinutes();
  const payload = getHourlyPayload(hour, minute);

  if (!payload) return;

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

    await channel.send(payload).catch(console.error);
  }
}
