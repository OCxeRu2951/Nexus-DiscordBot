# Changelog

All notable changes to Nexus Bot are documented in this file.

[日本語版はこちら](./CHANGELOG.ja.md)

---

## [v0.10.1] - 2026-10-28

### Changed
- Only members with `Manage Server` or the notification role can approve or reject applications
- `r!` now only cancels your own applications made in the same server
- `/role` can only manage roles below your highest role (`@everyone` and integration roles are excluded)
- `/ban`, `/kick`, `/timeout` and `/warn` can only target members below you
- `/lock` and `/slowmode` now require `Manage Channels` in the target channel
- `a!` / `b!` ignore repeated messages from the same member for 10 seconds
- `@everyone`, `@here` and role mentions typed by users no longer ping when Nexus repeats them (hourly messages and the `/recruit` notification role are unchanged)
- Server-only commands can no longer be used in DMs (`/dice`, `/help`, `/language` and `/timer` still work in DMs)
- Hourly message file URLs must be Discord file URLs (`cdn.discordapp.com` / `media.discordapp.net`); image and thumbnail URLs are unchanged
- Improved dashboard security
  - Reworked login and sessions (you will be signed out once with this update)
  - Settings are validated on save; channels from other servers and out-of-range values are rejected
  - Servers without Nexus, or where you lack admin permissions, can no longer be opened
- Now requires Node.js 24 or later; dependencies updated

### Fixed
- Nexus could stop running after certain actions
- Hourly messages, recruitment lists and forums no longer post to a channel that belongs to another server
- Moderation logs were not recorded for `/ban`, `/kick`, `/timeout`, `/untimeout`, `/unban` and `/role`
- `/afk set` and `/afk list` did not work (AFK now expires after the time set in each server)
- `/apply-config mode:export` could not export CSV (cells are also no longer treated as formulas in spreadsheet apps)
- Data could be deleted unexpectedly when retention settings had out-of-range values

---

## [v0.10.0] - 2026-09-30

### Added
- `/recruit` — recruitment posts with Join / Leave / Close buttons
  - Options: `title`, `capacity` (1-50), `duration` (minutes until the deadline), `description`, `mention` (role to notify)
  - The member list and count update in place; closes automatically when full or at the deadline, or manually by the host / members with `Manage Messages`
  - On close, the host and all members are mentioned in a reply to the post
  - Capacity cannot be exceeded by simultaneous clicks; deadline timers are restored after a restart
  - Closed recruitments are deleted 30 days after closing
  - The host's and members' display names are stored so the dashboard can show them
- Dashboard: Recruitment page listing open and closed posts with host, channel, deadline and members, plus an open-recruitments count on the overview
- Dashboard: two access levels. Non-admin members can open the Recruitment page (limited to viewer roles if set), see recruitments in channels they can view, and close their own; admins can edit recruitment settings from the page
- Server data auto-deletion: when Nexus is removed from a server, its data is kept for 30 days and then deleted. Re-adding Nexus within 30 days cancels the deletion, and servers left while the bot was offline are detected at startup
- Recruitment threads: each recruitment gets a thread (or a forum post, chosen with `/recruit-config mode:thread`); the host and members who join are added automatically. Skip with `thread:false` / `nothread`
- Recruitment list: `/recruit-config mode:list` keeps one message listing open recruitments (with post and thread links), updated on every change
- `/recruit-config` — choose `mode` (`list` / `thread` / `viewer` / `show`) to set the list channel, thread / forum mode and dashboard viewer roles, or show the current settings
- `b!` prefix for recruitment: `b!<title> [@count] [30m|2h]`, with details on the following lines (e.g. `b!Board games @3 60m`)

### Changed
- **Breaking:** application prefixes changed from `!apply` / `!revoke` to `a!` / `r!`
- **Breaking:** `r!` is no longer a dice prefix; dice use `d!` only (`d!2d6`, `d!coc7 60`, `d!dnd +5 adv`)
- All prefixes (`a!` / `r!` / `d!` / `b!`) are now matched regardless of full-width/half-width and upper/lower case (e.g. `Ａ！`, `ｒ！`, `Ｄ!`)
- `a!` no longer takes a separate comment; everything after `a!` (including spaces and line breaks) is stored as the application content
- `a!` is ignored in servers where no application channel is configured
- `r!<ID>` accepts full-width and lowercase IDs

### Fixed
- Leaving a server did not delete its language, prefix, hourly-announcement, guild settings or poll vote data, and tried to delete `reminders` / `afk` by a `guild_id` column that does not exist
- Applications with content longer than 1024 characters could not be shown in the notification embeds
- `/help command:<name>` showed a raw translation key instead of the "Options" heading

---

## [v0.9.0] - 2026-08-10

### Added
- Dice/TRPG check engine
  - `/dice` now supports a TRPG mode (`system:coc7` / `system:coc6` / `system:dnd5e`) alongside the existing legacy weighted-dice mode
  - Call of Cthulhu 7th Edition: 6-tier success degrees (Critical/Extreme/Hard/Regular/Failure/Fumble), Bonus/Penalty Dice
  - Call of Cthulhu 6th Edition: 4-tier success degrees (Critical/Regular/Failure/Fumble)
  - D&D 5e: d20 checks with Normal/Advantage/Disadvantage, Natural 20/1 indicator
- `r!` / `d!` prefix commands
  - Multi-group dice expressions (e.g. `r!2d6+1d4-3`, up to 3 dice groups, addition/subtraction only) — prefix-only, not available via Slash
  - TRPG shorthand syntax: `r!coc7 <target>`, `r!coc6 <target>`, `r!dnd <modifier> [adv|dis]`
  - Full-width input support (e.g. `ｒ！２ｄ６`) via NFKC normalization
- `/dice-prefix` — per-server and per-channel permission management for `r!`/`d!` (modes: `all` / `selected` / `disabled`, with channel-level `allow`/`deny`/`reset`, including thread inheritance from parent channel)
- `/language` — personal Bot response language setting (`Auto` / `日本語` / `English`)
- `/lang` — now supports `Auto` in addition to the existing server-wide language setting

### Changed
- Language resolution priority is now: **User manual setting → Server manual setting → Discord client locale → English** (previously server-only, defaulting to Japanese)
- `t()` translation fallback changed from Japanese-first to English-first, then raw key
- `deploy-commands.js` now localizes all command **options** (including subcommand options), not just top-level descriptions

### Fixed
- `/dice show_odds:true` with a large `sides` value could exceed Discord's 1024-character Embed field limit, causing the command to fail silently
- `/modhistory` had no upper limit on the number of Embed fields generated, risking Discord's 25-field limit and per-field character limit on servers with long moderation histories

---

## [v0.8.0] - Moderation Suite

### Added
- Full moderation command set: `/warn`, `/warnings`, `/clearwarn`, `/kick`, `/ban`, `/unban`, `/timeout`, `/untimeout`, `/slowmode`, `/lock`, `/role`, `/note`, `/modhistory`, `/setmod`
- Warning point threshold system with automatic kick/ban/timeout action
- Moderation log channel support

---

## [v0.7.0] - Application System

### Added
- `!apply` / `!revoke` prefix commands for a server application/recruitment workflow
- `/apply-config` for channel, notification method, and admin channel setup
- Approve/reject buttons with applicant DM notifications
- CSV export of application data

---

[Unreleased changes are tracked on the `main` branch.]
