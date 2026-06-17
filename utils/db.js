import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initDb() {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS reminders (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT    NOT NULL,
        channel_id TEXT    NOT NULL,
        label      TEXT    NOT NULL,
        fire_at    INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS afk (
        user_id TEXT PRIMARY KEY,
        reason  TEXT    NOT NULL,
        since   INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS warnings (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id  TEXT    NOT NULL,
        user_id   TEXT    NOT NULL,
        moderator_id TEXT NOT NULL,
        reason    TEXT    NOT NULL,
        points    INTEGER NOT NULL DEFAULT 1,
        issued_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS mod_notes (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id     TEXT    NOT NULL,
        user_id      TEXT    NOT NULL,
        moderator_id TEXT    NOT NULL,
        note         TEXT    NOT NULL,
        created_at   INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS mod_logs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id     TEXT    NOT NULL,
        action       TEXT    NOT NULL,
        target_id    TEXT    NOT NULL,
        moderator_id TEXT    NOT NULL,
        reason       TEXT,
        created_at   INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS mod_settings (
        guild_id        TEXT PRIMARY KEY,
        log_channel_id  TEXT,
        warn_threshold_timeout INTEGER DEFAULT 3,
        warn_threshold_ban     INTEGER DEFAULT 5,
        timeout_duration_min   INTEGER DEFAULT 60,
        automod_enabled        INTEGER DEFAULT 0,
        automod_spam           INTEGER DEFAULT 0,
        automod_invite         INTEGER DEFAULT 0,
        automod_badwords       TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        guild_id          TEXT PRIMARY KEY,
        hourly_channel_id TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS polls (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id    TEXT    NOT NULL,
        channel_id    TEXT    NOT NULL,
        guild_id      TEXT    NOT NULL,
        question      TEXT    NOT NULL,
        choices       TEXT    NOT NULL,
        end_at        INTEGER,
        anonymous     INTEGER NOT NULL DEFAULT 0,
        max_choices   INTEGER NOT NULL DEFAULT 1,
        role_id TEXT,
        hide_results  INTEGER NOT NULL DEFAULT 0,
        created_by    TEXT    NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS applications (
        id          TEXT    PRIMARY KEY,
        guild_id    TEXT    NOT NULL,
        channel_id  TEXT    NOT NULL,
        user_id     TEXT    NOT NULL,
        username    TEXT    NOT NULL,
        content     TEXT    NOT NULL,
        comment     TEXT,
        status      TEXT    NOT NULL DEFAULT 'pending',
        created_at  INTEGER NOT NULL,
        resolved_at INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS apply_settings (
        guild_id         TEXT PRIMARY KEY,
        apply_channel_id TEXT,
        operator_role_id TEXT,
        notify_type      TEXT DEFAULT 'dm',
        notify_target    TEXT,
        admin_channel_id TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id         TEXT PRIMARY KEY,
        afk_hours        INTEGER DEFAULT 24,
        poll_days        INTEGER DEFAULT 7,
        warnings_days    INTEGER DEFAULT 90,
        application_days INTEGER DEFAULT 90
      )`,
      `CREATE TABLE IF NOT EXISTS hourly_messages (
        guild_id    TEXT    NOT NULL,
        hour        INTEGER NOT NULL,
        content     TEXT,
        image_url   TEXT,
        file_url    TEXT,
        embed       TEXT,
        enabled     INTEGER DEFAULT 1,
        PRIMARY KEY (guild_id, hour)
      )`,
      `CREATE TABLE IF NOT EXISTS guild_lang (
        guild_id TEXT PRIMARY KEY,
        lang     TEXT NOT NULL DEFAULT 'ja'
      )`,
    ],
    "write",
  );
}
