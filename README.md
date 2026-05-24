# Nexus Bot

> An all-in-one utility Discord Bot

[![Version](https://img.shields.io/badge/version-v0.7.0-f07830)](https://github.com/OCxeRu2951/DiscordBot-Nexus/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](./LICENSE)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865f2)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)

[日本語版のREADMEはこちら](./README/ja-README.md)

---

## Overview

Nexus is a Discord utility bot featuring moderation, hourly announcements, polls, and an application system. It uses slash commands as its primary interface, with data persistence via Turso (libSQL) and a Cloudflare Pages dashboard for configuration management.

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
| `/setmod` | Configure moderation settings (log channel, etc.) |

### Utility

| Command | Description |
| --- | --- |
| `/timer start` | Start a timer (minutes / seconds) |
| `/timer stop` | Stop a timer |
| `/clear` | Bulk delete messages (with user filter) |
| `/poll` | Create a poll (anonymous, multi-choice, role-restricted) |
| `/dice` | Weighted dice with buff / debuff mechanics |
| `/afk set` | Set AFK status |
| `/afk list` | List AFK users |
| `/serverinfo` | Display server information |
| `/userinfo` | Display user information |
| `/lang` | Switch language (Japanese / English) |

### Hourly Announcements

| Command | Description |
| --- | --- |
| `/sethourly set` | Set the hourly announcement channel |
| `/sethourly unset` | Disable hourly announcements |

Configure per-hour and per-day-of-week messages (text, embed, image, file) via the dashboard.

### Application System

| Command | Description |
| --- | --- |
| `!apply <content> [comment]` | Submit an application |
| `!revoke <ID>` | Cancel an application |
| `/apply-config` | Configure the application system |

Application management with approve / reject buttons. Application IDs are sent via DM or channel notification.

## Tech Stack

| Item | Technology |
| --- | --- |
| Runtime | Node.js 20+ (ESModule) |
| Framework | discord.js v14 |
| Database | Turso (libSQL) |
| Hosting | GCP e2-micro |
| CI/CD | GitHub Actions (SSH deploy) |
| Dashboard | Cloudflare Pages + Workers |
| License | AGPL-3.0 |

## Database Tables

```
reminders        Timer reminders
afk              AFK status
warnings         Warnings
mod_notes        Moderation notes
mod_logs         Moderation logs
mod_settings     Moderation settings
settings         Server settings
polls            Polls
applications     Applications
apply_settings   Application system settings
guild_settings   Guild settings (retention periods, etc.)
hourly_messages  Hourly announcement messages
guild_lang       Language settings
```

## Project Structure

```dir
DiscordBot-Nexus/
├── commands/
│   ├── timer.js, clear.js, poll.js, dice.js
│   ├── serverinfo.js, userinfo.js, afk.js, lang.js
│   ├── sethourly.js
│   ├── warn.js, warnings.js, clearwarn.js
│   ├── kick.js, ban.js, unban.js
│   ├── timeout.js, untimeout.js
│   ├── slowmode.js, lock.js, role.js
│   ├── note.js, modhistory.js, setmod.js
│   └── apply-config.js
├── events/
│   ├── ready.js
│   ├── interactionCreate.js
│   ├── messageCreate.js
│   ├── guildCreate.js
│   └── guildDelete.js
├── utils/
│   ├── db.js
│   ├── modLog.js
│   ├── applyExport.js
│   └── i18n.js
├── data/
│   └── jsons/lang/
│       ├── ja.json
│       └── en.json
├── index.js
├── deploy-commands.js
├── Dockerfile
└── package.json
```

## Setup

### Prerequisites

- Node.js 20+
- Turso account and database
- A Discord application created in the Discord Developer Portal

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

### Initialize Database

```bash
node utils/db.js
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

## Deployment (GCP)

Automatic deployment via GitHub Actions is configured in the private repository. Pushing to the main branch automatically deploys to GCP e2-micro via SSH.

```bash
# Manual deployment
ssh user@your-gcp-instance
cd ~/DiscordBot-Nexus
git pull origin main
pm2 restart nexus
```

## Version Roadmap

| Version | Content | Status |
| --- | --- | --- |
| v0.7.0 | Application system | Done |
| v0.8.0 | Moderation suite | Done |
| v0.9.0 | Pomodoro / /botstatus | Planned |
| v0.10.0 | Game commands | Planned |
| v1.0.0 | Stable public release | Planned |
| v1.1.0 | Day-of-week hourly, full i18n, guild_settings migration | Planned |
| v1.2.0 | Multi-play recruitment system | Planned |
| v1.3.0 | RSS feeds | Planned |
| v1.4.0 | Dashboard additional features | Planned |
| v2.0.0 | Paid plans, Rust (serenity) migration | Planned |

## Related Repositories

- [Nexus Dashboard](https://github.com/OCxeRu2951/Nexus-Dashboard) — Admin dashboard
- [Nexus Pages](https://github.com/OCxeRu2951/Nexus-Pages) — Public info pages

## License

[AGPL-3.0](./LICENSE) © 2026 OCxeRu2951

This software is released under the AGPL-3.0 license. Any modifications or distributions must also make the source code publicly available.
