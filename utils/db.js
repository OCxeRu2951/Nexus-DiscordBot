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
        reason    TEXT    NOT NULL,
        issued_at INTEGER NOT NULL
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
        required_role TEXT,
        hide_results  INTEGER NOT NULL DEFAULT 0
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
    ],
    "write",
  );
}
