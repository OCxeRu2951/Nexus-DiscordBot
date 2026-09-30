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
        required_role TEXT,
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
      `CREATE TABLE IF NOT EXISTS user_lang (
        user_id TEXT PRIMARY KEY,
        lang    TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS poll_votes (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        poll_id   INTEGER NOT NULL,
        user_id   TEXT    NOT NULL,
        choice    INTEGER NOT NULL,
        voted_at  INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS guild_prefix_settings (
        guild_id TEXT PRIMARY KEY,
        mode     TEXT NOT NULL CHECK (mode IN ('all', 'selected', 'disabled'))
      )`,
      `CREATE TABLE IF NOT EXISTS prefix_channel_settings (
        guild_id   TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        permission TEXT NOT NULL CHECK (permission IN ('allow', 'deny')),
        PRIMARY KEY (guild_id, channel_id)
      )`,
      `CREATE TABLE IF NOT EXISTS recruits (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT    NOT NULL,
        channel_id  TEXT    NOT NULL,
        message_id  TEXT,
        author_id   TEXT    NOT NULL,
        author_name TEXT,
        title       TEXT    NOT NULL,
        description TEXT,
        capacity    INTEGER,
        end_at      INTEGER,
        lang        TEXT    NOT NULL DEFAULT 'en',
        status      TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
        close_reason TEXT,
        thread_id   TEXT,
        thread_kind TEXT,
        view_channel_id TEXT,
        created_at  INTEGER NOT NULL,
        closed_at   INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS recruit_members (
        recruit_id INTEGER NOT NULL,
        guild_id   TEXT    NOT NULL,
        user_id    TEXT    NOT NULL,
        username   TEXT,
        joined_at  INTEGER NOT NULL,
        PRIMARY KEY (recruit_id, user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS guild_deletion_queue (
        guild_id     TEXT PRIMARY KEY,
        scheduled_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS recruit_settings (
        guild_id                TEXT PRIMARY KEY,
        list_channel_id         TEXT,
        list_message_id         TEXT,
        list_message_channel_id TEXT,
        thread_mode             TEXT NOT NULL DEFAULT 'thread' CHECK (thread_mode IN ('thread', 'forum')),
        forum_channel_id        TEXT,
        viewer_role_ids         TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS recruit_actions (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id     TEXT    NOT NULL,
        recruit_id   INTEGER,
        action       TEXT    NOT NULL CHECK (action IN ('close', 'refresh_list')),
        requested_by TEXT,
        created_at   INTEGER NOT NULL,
        processed_at INTEGER,
        result       TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_recruit_actions_pending ON recruit_actions (processed_at)`,
    ],
    "write",
  );

  // ---- 既存DB向けの列追加 ----
  // CREATE TABLE IF NOT EXISTS は既存テーブルに列を足さないため、不足分だけ追加する
  await addColumnIfMissing("recruits", "author_name", "TEXT");
  await addColumnIfMissing("recruit_members", "username", "TEXT");
  await addColumnIfMissing("recruits", "thread_id", "TEXT");
  await addColumnIfMissing("recruits", "thread_kind", "TEXT");
  await addColumnIfMissing("recruits", "view_channel_id", "TEXT");
}

async function addColumnIfMissing(table, column, type) {
  const { rows } = await db.execute(`PRAGMA table_info(${table})`);
  if (rows.some((r) => r.name === column)) return;
  await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  console.log(`Added column ${table}.${column}`);
}
