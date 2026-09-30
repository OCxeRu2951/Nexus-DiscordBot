# Nexus Bot

> An all-in-one utility Discord Bot

[![Version](https://img.shields.io/badge/version-v0.7.0-f07830)](https://github.com/OCxeRu2951/DiscordBot-Nexus/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](./LICENSE)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865f2)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)

[日本語版のREADMEはこちら](./README/ja-README.md)

---

## Overview

Nexus is a Discord utility bot featuring moderation, hourly announcements, polls, recruitment posts, a dice/TRPG engine, and an application system. It uses slash commands as its primary interface plus short prefix commands (`a!` / `r!` for applications, `d!` for fast dice rolling, `b!` for recruitment), with data persistence via Turso (libSQL) and a Cloudflare Pages dashboard for configuration management.

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
| `d!<expr>` | Prefix dice expression, e.g. `d!2d6+1d4-3` (max 3 dice groups, addition/subtraction only) |
| `d!coc7 <target>` | Prefix shorthand for a CoC 7th check |
| `d!coc6 <target>` | Prefix shorthand for a CoC 6th check |
| `d!dnd <modifier> [adv\|dis]` | Prefix shorthand for a D&D 5e check |

**Design notes:**
- `buff` / `debuff` (weighted RNG) is completely separate from TRPG dice — TRPG checks always use a fair, unweighted roll.
- Multi-group dice expressions (`2d6+1d4-3d8`) are **prefix-only**; the Slash `/dice` command does not expose an `expression` option.
- `d!` is the only dice prefix. `r!` is reserved for cancelling applications.
- All prefixes (`a!` / `r!` / `d!` / `b!`) are matched regardless of full-width/half-width and upper/lower case via NFKC normalization (`ｄ！２ｄ６`, `Ｄ!2d6`), so they work the same from mobile IME input.
- `/dice-prefix mode` / `/dice-prefix channel` lets server admins restrict which channels allow `d!` (modes: `all` / `selected` / `disabled`, with per-channel `allow`/`deny`/`reset` overrides, including thread inheritance from the parent channel).

### Utility

| Command | Description |
| --- | --- |
| `/timer start` | Start a timer (minutes / seconds) |
| `/timer stop` | Stop a timer |
| `/clear` | Bulk delete messages (with user filter) |
| `/poll` | Create a poll (anonymous, multi-choice, role-restricted) |
| `/recruit` | Create a recruitment post with Join / Leave / Close buttons |
| `/recruit-config mode:<list\|thread\|viewer\|show>` | Recruitment settings: list channel, thread / forum, dashboard viewer roles, current settings (requires `Manage Server`) |
| `/afk set` | Set AFK status |
| `/afk list` | List AFK users |
| `/serverinfo` | Display server information |
| `/userinfo` | Display user information |
| `/help` | Show command list / details |

### Recruitment

`/recruit title:<title> [capacity:<1-50>] [duration:<minutes>] [description:<details>] [mention:<role>] [thread:<true|false>]`

Prefix form:

```
b!<title> [@count] [deadline] [nothread]
<details on the following lines>

b!Board games @3 60m
b!Raid @4 2h
```

- `@count` (`@3`, `＠３`, `@3人`) sets the capacity. The deadline accepts `30m` / `30min` / `30分` / `2h` / `2時間`. `nothread` (`スレなし`) skips the thread. All are recognized only as separate words, in any position on the first line.
- The recruitment post is sent as a reply to the `b!` message. Role mentions in a `b!` message ping as usual (they come from the user) and are removed from the title.

- Posts an embed with **Join** / **Leave** / **Close** buttons; the member list and count update in place.
- Closes automatically when the capacity is reached or the deadline passes. The host, or anyone with `Manage Messages`, can close it manually.
- On close, Nexus replies to the post mentioning the host and all members.
- Capacity is enforced in a single SQL statement, so simultaneous clicks cannot overfill it. Deadline timers are restored after a restart.
- `mention` pings a role once when posting. Non-mentionable roles and `@everyone` require the `Mention Everyone` permission.
- Closed recruitments are deleted 30 days after closing.

**Threads / forum posts** — Each recruitment gets its own thread by default (`thread:false` / `nothread` to skip). `/recruit-config mode:thread type:<Thread|Forum> [forum:<channel>]` chooses between a thread created from the post and a post in a forum channel (falls back to a thread if the forum post fails). The host and every member who joins are added to the thread, and the thread stays open after closing.

**Recruitment list** — `/recruit-config mode:list channel:<channel>` keeps one message in that channel listing every open recruitment (title linked to the post, count, deadline, host and thread / forum link). It is edited whenever a recruitment is created, joined, left or closed; bursts of changes are merged into one edit, and a deleted list message is recreated.

**Dashboard** — Server admins see and manage everything and can change the settings above. Other members see the recruitments in channels they can view in Discord and can close their own (members with `Manage Messages` can close any). `/recruit-config mode:viewer action:<Add|Remove|Reset> role:<role>` limits member access to specific roles (everyone by default). Closing from the dashboard is queued and carried out by the bot within a few seconds, so the post update and member notifications are the same as with the button.

Required bot permissions for threads: `Create Public Threads` and `Send Messages in Threads` (and `Send Messages` in the forum channel for forum mode).

### Hourly Announcements

| Command | Description |
| --- | --- |
| `/sethourly set` | Set the hourly announcement channel |
| `/sethourly unset` | Disable hourly announcements |

Per-hour and per-day-of-week messages (text / embed / image / file) are configured via the dashboard.

### Application System

| Command | Description |
| --- | --- |
| `a!<content>` | Submit an application (configured channel only; everything after `a!` is the content) |
| `r!<ID>` | Cancel an application |
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
│   ├── prefix.js                # /dice-prefix — d! channel permission config
│   ├── recruit.js               # /recruit — recruitment post
│   ├── recruit-config.js        # /recruit-config — list / thread / viewer settings
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
│   │   ├── prefixSyntax.js      # d!coc7 / d!dnd shorthand parser
│   │   └── index.js             # shared entry point (performTrpgCheck)
│   ├── prefix/
│   │   └── permission.js        # channel permission resolution (Guild mode + overrides + thread inheritance)
│   └── recruit/
│       ├── index.js             # recruitment DB ops, embed/buttons, close timers, button handler
│       ├── list.js              # recruitment list message (debounced, single message)
│       ├── thread.js            # thread / forum post creation, adding members
│       ├── actions.js           # executes dashboard requests (close / refresh list)
│       ├── settings.js          # recruit_settings read/write
│       └── prefixSyntax.js      # b! syntax parser + shared limits
├── aspects/
│   ├── normalization.js         # NFKC normalization + width/case-insensitive prefix matching
│   └── language.js              # thin wrapper around utils/i18n.js resolveLang
├── events/
│   ├── ready.js
│   ├── interactionCreate.js     # resolves lang via getLang(interaction), dispatches to commands
│   ├── messageCreate.js         # a!/r! applications + d! dice + b! recruitment
│   ├── guildCreate.js
│   └── guildDelete.js
├── utils/
│   ├── db.js
│   ├── modLog.js
│   ├── applyExport.js
│   ├── guildCleanup.js          # 30-day deletion queue for servers the bot has left
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
recruits / recruit_members  Recruitment posts and members
recruit_settings         Recruitment list channel, thread mode, dashboard viewer roles
recruit_actions          Requests from the dashboard, processed by the bot
guild_deletion_queue     Scheduled deletion of server data
```

When Nexus is removed from a server, that server's data is kept for 30 days and then deleted from every guild-scoped table. Re-adding Nexus within 30 days cancels the deletion. Servers the bot left while offline are detected and scheduled at startup.

## Setup

### Prerequisites

- Node.js 20+
- Turso account and database
- A Discord application created in the Discord Developer Portal
- **Message Content Intent** enabled in the Developer Portal (required for the `a!` / `r!` / `d!` / `b!` prefix commands)

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
d!2d6                  Roll 2d6
d!2d6+1d4-3            Up to 3 dice groups, addition/subtraction only
d!coc7 60              CoC 7th check, skill 60
d!coc6 60              CoC 6th check, skill 60
d!dnd +5               D&D 5e check, modifier +5
d!dnd +5 adv           ... with advantage
d!dnd +5 dis           ... with disadvantage
```

Full-width input (`ｄ！２ｄ６`) works identically. `r!` is no longer a dice prefix. Availability per channel is controlled by `/dice-prefix`.

## Version Roadmap

| Version | Content | Status |
| --- | --- | --- |
| v0.7.0 | Application system | Done |
| v0.8.0 | Moderation suite | Done |
| v0.9.0 | Dice/TRPG engine (coc7, coc6, dnd5e) + Prefix permission system | Done |
| v0.10.0 | Recruitment (`/recruit`, `b!`) + prefix redesign (`a!` / `r!` / `d!`) | Done |
| v0.11.0 | Additional TRPG systems (sw25, dx3), Session integration | Planned |
| v1.0.0 | Stable public release | Planned |
| v2.0.0 | Paid plans, Rust (serenity) migration | Planned |

## Related Repositories

- [Nexus Dashboard](https://github.com/OCxeRu2951/Nexus-Dashboard) — Admin dashboard
- [Nexus Pages](https://github.com/OCxeRu2951/Nexus-Pages) — Public info pages

## License

[AGPL-3.0](./LICENSE) © 2026 OCxeRu2951

This software is released under the AGPL-3.0 license. Any modifications or distributions must also make the source code publicly available.
