# Nexus Bot

> An all-in-one utility Discord Bot

[![Version](https://img.shields.io/badge/version-v0.7.0-f07830)](https://github.com/OCxeRu2951/DiscordBot-Nexus/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](./LICENSE)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865f2)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)

[日本語版のREADMEはこちら](./README/ja-README.md)

---

## Overview

Nexus is a Discord utility bot featuring moderation, hourly announcements, polls, a dice/TRPG engine, and an application system. It uses slash commands as its primary interface plus a `r!`/`d!` prefix for fast dice rolling, with data persistence via Turso (libSQL) and a Cloudflare Pages dashboard for configuration management.

## Features

### Moderation

| Command | Description |
| --- | --- |
| `/warn` | Issue a warning to a user |
| `/warnings` | View warning history |
| `/clearwarn` | Delete a warning |
| `/kick` | Kick a user |
| `/ban` | Ban a user |
| `/unban` | Unban a user |
| `/timeout` | Set a timeout |
| `/untimeout` | Remove a timeout |
| `/slowmode` | Set slowmode |
| `/lock` | Lock / unlock a channel |
| `/role` | Grant / revoke a role |
| `/note` | Add a note to a user |
| `/modhistory` | View moderation history |
| `/setmod` | Configure moderation settings (log channel, warning thresholds) |

### Dice & TRPG

Nexus has two independent dice systems and a growing TRPG rule engine, all sharing a single Fair Roller under the hood (`components/dice/engine.js`).

| Command | Description |
| --- | --- |
| `/dice` (legacy mode) | Weighted dice with `sides` / `count` / `modifier` / `buff` / `debuff` / `set` / `show_odds` |
| `/dice system:coc7 ...` | Call of Cthulhu 7th Edition skill check (1d100) |
| `/dice system:coc6 ...` | Call of Cthulhu 6th Edition skill check (1d100) |
| `/dice system:dnd5e ...` | D&D 5e d20 check (normal / advantage / disadvantage) |
| `r!<expr>` / `d!<expr>` | Prefix dice expression, e.g. `r!2d6+1d4-3` (max 3 dice groups, addition/subtraction only) |
| `r!coc7 <target>` / `d!coc7 <target>` | Prefix shorthand for a CoC 7th check |
| `r!coc6 <target>` / `d!coc6 <target>` | Prefix shorthand for a CoC 6th check |
| `r!dnd <modifier> [adv\|dis]` | Prefix shorthand for a D&D 5e check |

**Design notes:**
- `buff` / `debuff` (weighted RNG) is completely separate from TRPG dice — TRPG checks always use a fair, unweighted roll.
- Multi-group dice expressions (`2d6+1d4-3d8`) are **prefix-only**; the Slash `/dice` command does not expose an `expression` option.
- Full-width input (`ｒ！２ｄ６`) is normalized via NFKC before parsing, so prefix commands work the same from mobile IME input.
- `/dice-prefix mode` / `/dice-prefix channel` lets server admins restrict which channels allow `r!`/`d!` (modes: `all` / `selected` / `disabled`, with per-channel `allow`/`deny`/`reset` overrides, including thread inheritance from the parent channel).

### Utility

| Command | Description |
| --- | --- |
| `/timer start` | Start a timer (minutes / seconds) |
| `/timer stop` | Stop a timer |
| `/clear` | Bulk delete messages (with user filter) |
| `/poll` | Create a poll (anonymous, multi-choice, role-restricted) |
| `/afk set` | Set AFK status |
| `/afk list` | List AFK users |
| `/serverinfo` | Display server information |
| `/userinfo` | Display user information |
| `/help` | Show command list / details |

### Hourly Announcements

| Command | Description |
| --- | --- |
| `/sethourly set` | Set the hourly announcement channel |
| `/sethourly unset` | Disable hourly announcements |

Per-hour and per-day-of-week messages (text / embed / image / file) are configured via the dashboard.

### Application System

| Command | Description |
| --- | --- |
| `!apply <content> [comment]` | Submit an application (prefix command, in the configured channel only) |
| `!revoke <ID>` | Cancel an application |
| `/apply-config` | Configure the application system (channel, notification role/method, admin channel, view, CSV export) |

### Language

| Command | Description |
| --- | --- |
| `/language` | Set your **personal** Bot response language (`Auto` / `日本語` / `English`) |
| `/lang` | Set the **server's default** Bot response language (requires `Manage Server`) |

Resolution priority: **User manual setting → Server manual setting → Discord client locale → English**. Slash Command UI localization (names/descriptions shown in Discord) is handled separately via `deploy-commands.js` and is independent of this response-language logic.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 20+ (ESModule) |
| Framework | discord.js v14 |
| Database | Turso (libSQL) |
| Hosting | GCP e2-micro |
| Dashboard | Cloudflare Pages + Workers |
| License | AGPL-3.0 |

## Project Structure

```
DiscordBot-Nexus/
├── commands/                  # Slash command definitions (Adapters)
│   ├── dice.js                 # /dice — legacy + TRPG mode
│   ├── prefix.js                # /dice-prefix — r!/d! channel permission config
│   ├── language.js / lang.js    # personal / server language settings
│   └── ... (moderation, utility, apply-config, etc.)
├── components/
│   ├── dice/
│   │   ├── parser.js            # string → terms[] (Dice Group parsing only)
│   │   ├── validator.js         # limit checks (groups/count/sides/modifier)
│   │   ├── engine.js            # Fair Roller — rollDie(sides, rng)
│   │   ├── formatter.js         # result terms[] → display text
│   │   ├── odds.js              # probability distribution (single group + buff/debuff)
│   │   └── index.js             # shared entry point used by Prefix Adapter
│   ├── trpg/
│   │   ├── registry.js          # TRPG_SYSTEMS map (coc7 / coc6 / dnd5e)
│   │   ├── validator.js         # TRPG input validation
│   │   ├── coc7.js / coc6.js    # pure rule functions, reuse Dice Engine's rollDie
│   │   ├── dnd5e.js             # pure rule functions
│   │   ├── formatter.js         # Detailed (Slash) / Compact (Prefix) + cross-system dispatch
│   │   ├── prefixSyntax.js      # r!coc7 / r!dnd shorthand parser
│   │   └── index.js             # shared entry point (performTrpgCheck)
│   └── prefix/
│       └── permission.js        # channel permission resolution (Guild mode + overrides + thread inheritance)
├── aspects/
│   ├── normalization.js         # NFKC normalization (full-width → half-width)
│   └── language.js              # thin wrapper around utils/i18n.js resolveLang
├── events/
│   ├── ready.js
│   ├── interactionCreate.js     # resolves lang via getLang(interaction), dispatches to commands
│   ├── messageCreate.js         # !apply/!revoke + r!/d! Prefix Adapter
│   ├── guildCreate.js
│   └── guildDelete.js
├── utils/
│   ├── db.js
│   ├── modLog.js
│   ├── applyExport.js
│   └── i18n.js                  # t() / resolveLang() / getUserLang() / getGuildLang()
├── data/
│   └── jsons/lang/
│       ├── ja.json
│       └── en.json
├── index.js
├── deploy-commands.js            # registers commands + injects description_localizations
├── Dockerfile
└── package.json
```

## Database Tables

```
reminders             Timer reminders
afk                    AFK status
warnings               Warnings
mod_notes              Moderation notes
mod_logs               Moderation logs
mod_settings           Moderation settings
settings                Server settings
polls / poll_votes     Polls
applications            Applications
apply_settings          Application system settings
guild_settings           Guild settings (retention periods, etc.)
hourly_messages         Hourly announcement messages
guild_lang / user_lang   Language settings (server / personal)
guild_prefix_settings    Prefix mode per guild (all/selected/disabled)
prefix_channel_settings  Per-channel prefix override (allow/deny)
```

## Setup

### Prerequisites

- Node.js 20+
- Turso account and database
- A Discord application created in the Discord Developer Portal
- **Message Content Intent** enabled in the Developer Portal (required for `!apply`/`!revoke` and `r!`/`d!` prefix commands)

### Installation

```bash
git clone https://github.com/OCxeRu2951/DiscordBot-Nexus.git
cd DiscordBot-Nexus
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_turso_token
```

### Register Commands

```bash
node deploy-commands.js
```

### Start

```bash
node index.js

# Or with PM2
pm2 start index.js --name nexus
```

## Prefix Dice Quick Reference

```
r!2d6                  Roll 2d6
d!2d6+1d4-3            Up to 3 dice groups, addition/subtraction only
r!coc7 60              CoC 7th check, skill 60
r!coc6 60              CoC 6th check, skill 60
r!dnd +5               D&D 5e check, modifier +5
r!dnd +5 adv           ... with advantage
r!dnd +5 dis           ... with disadvantage
```

Full-width input (`ｒ！２ｄ６`) works identically. Availability per channel is controlled by `/dice-prefix`.

## Version Roadmap

| Version | Content | Status |
| --- | --- | --- |
| v0.7.0 | Application system | Done |
| v0.8.0 | Moderation suite | Done |
| v0.9.0 | Dice/TRPG engine (coc7, coc6, dnd5e) + Prefix permission system | Done |
| v0.10.0 | Additional TRPG systems (sw25, dx3), Session/Recruitment integration | Planned |
| v1.0.0 | Stable public release | Planned |
| v2.0.0 | Paid plans, Rust (serenity) migration | Planned |

## Related Repositories

- [Nexus Dashboard](https://github.com/OCxeRu2951/Nexus-Dashboard) — Admin dashboard
- [Nexus Pages](https://github.com/OCxeRu2951/Nexus-Pages) — Public info pages

## License

[AGPL-3.0](./LICENSE) © 2026 OCxeRu2951

This software is released under the AGPL-3.0 license. Any modifications or distributions must also make the source code publicly available.
