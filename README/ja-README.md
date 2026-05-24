# Nexus Bot

> Discord向けオールインワンユーティリティBot

[![Version](https://img.shields.io/badge/version-v0.7.0-f07830)](https://github.com/OCxeRu2951/DiscordBot-Nexus/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](./LICENSE)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865f2)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)

[Click here for the English README.](../README.md)

---

## 概要

Nexusはモデレーション・時報・投票・申請システムなどを備えたDiscordユーティリティBotです。スラッシュコマンドを主体とし、Turso（libSQL）によるデータ永続化とCloudflare Pagesダッシュボードによる設定管理に対応しています。

## 機能一覧

### モデレーション

| コマンド | 説明 |
| --- | --- |
| `/warn` | ユーザーに警告を発行 |
| `/warnings` | 警告履歴を表示 |
| `/clearwarn` | 警告を削除 |
| `/kick` | ユーザーをキック |
| `/ban` | ユーザーをBAN |
| `/unban` | BAN解除 |
| `/timeout` | タイムアウトを設定 |
| `/untimeout` | タイムアウトを解除 |
| `/slowmode` | スローモードを設定 |
| `/lock` | チャンネルをロック / アンロック |
| `/role` | ロールを付与 / 剥奪 |
| `/note` | ユーザーにメモを追加 |
| `/modhistory` | モデレーション履歴を表示 |
| `/setmod` | モデレーション設定（ログチャンネル等） |

### ユーティリティ

| コマンド | 説明 |
| --- | --- |
| `/timer start` | タイマー開始（分・秒指定） |
| `/timer stop` | タイマー停止 |
| `/clear` | メッセージ一括削除（ユーザーフィルター対応） |
| `/poll` | 投票作成（匿名・複数選択・ロール制限対応） |
| `/dice` | バフ・デバフ付きダイス |
| `/afk set` | AFK設定 |
| `/afk list` | AFK一覧表示 |
| `/serverinfo` | サーバー情報表示 |
| `/userinfo` | ユーザー情報表示 |
| `/lang` | 言語切り替え（日本語 / 英語） |

### 時報

| コマンド | 説明 |
| --- | --- |
| `/sethourly set` | 時報チャンネルを設定 |
| `/sethourly unset` | 時報を解除 |

ダッシュボードから時間・曜日別のメッセージ（テキスト・Embed・画像・ファイル）を設定可能。

### 申請システム

| コマンド | 説明 |
| --- | --- |
| `!apply <内容> [コメント]` | 申請を送信 |
| `!revoke <ID>` | 申請を取り消し |
| `/apply-config` | 申請システムの設定 |

承認・拒否ボタン付きの申請管理。申請IDはDMまたはチャンネルで通知。

## 技術スタック

| 項目 | 技術 |
| --- | --- |
| ランタイム | Node.js 20+ (ESModule) |
| フレームワーク | discord.js v14 |
| データベース | Turso (libSQL) |
| ホスティング | GCP e2-micro |
| CI/CD | GitHub Actions (SSH deploy) |
| ダッシュボード | Cloudflare Pages + Workers |
| ライセンス | AGPL-3.0 |

## DBテーブル

```
reminders        タイマー
afk              AFK
warnings         警告
mod_notes        モデレーションメモ
mod_logs         モデレーションログ
mod_settings     モデレーション設定
settings         サーバー設定
polls            投票
applications     申請
apply_settings   申請設定
guild_settings   ギルド設定（保持期間等）
hourly_messages  時報メッセージ
guild_lang       言語設定
```

## プロジェクト構成

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

## セットアップ

### 前提条件

- Node.js 20以上
- Tursoアカウント・データベース
- Discord Developer PortalでBotを作成済み

### インストール

```bash
git clone https://github.com/OCxeRu2951/DiscordBot-Nexus.git
cd DiscordBot-Nexus
npm install
```

### 環境変数

`.env` ファイルをプロジェクトルートに作成します。

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_turso_token
```

### DBの初期化

```bash
node utils/db.js
```

### コマンド登録

```bash
node deploy-commands.js
```

### 起動

```bash
node index.js

# または PM2 を使う場合
pm2 start index.js --name nexus
```

## デプロイ（GCP）

GitHub Actionsによる自動デプロイが設定されています（プライベートリポジトリ）。mainブランチへのpushで自動的にGCP e2-microにSSHデプロイされます。

```bash
# 手動デプロイの場合
ssh user@your-gcp-instance
cd ~/DiscordBot-Nexus
git pull origin main
pm2 restart nexus
```

## バージョンロードマップ

| バージョン | 内容 | 状態 |
| --- | --- | --- |
| v0.7.0 | 申請システム | 実装済み |
| v0.8.0 | モデレーションスイート | 実装済み |
| v0.9.0 | ポモドーロ・/botstatus | 予定 |
| v0.10.0 | ゲームコマンド | 予定 |
| v1.0.0 | 正式リリース | 予定 |
| v1.1.0 | 時報曜日別・i18n全対応・guild_settings移行 | 予定 |
| v1.2.0 | マルチ募集システム | 予定 |
| v1.3.0 | RSS配信 | 予定 |
| v1.4.0 | ダッシュボード追加機能 | 予定 |
| v2.0.0 | 有料プラン・Rust(serenity)移行開始 | 予定 |

## 関連リポジトリ

- [Nexus Dashboard](https://github.com/OCxeRu2951/Nexus-Dashboard) — 管理ダッシュボード
- [Nexus Pages](https://github.com/OCxeRu2951/Nexus-Pages) — 公開情報ページ

## ライセンス

[AGPL-3.0](./LICENSE) © 2026 OCxeRu2951

本ソフトウェアはAGPL-3.0ライセンスの下で公開されています。改変・再配布の際はソースコードの公開が必要です。
