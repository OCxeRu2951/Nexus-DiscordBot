# Changelog

All notable changes to Nexus Bot are documented in this file.

[日本語版はこちら](./CHANGELOG.ja.md)

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
