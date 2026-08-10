# Nexus Bot

> Discord向けオールインワンユーティリティBot

[![Version](https://img.shields.io/badge/version-v0.7.0-f07830)](https://github.com/OCxeRu2951/DiscordBot-Nexus/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](../LICENSE)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865f2)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)

[English README](../README.md)

---

## 概要

Nexusはモデレーション・時報・投票・ダイス/TRPGエンジン・申請システムを備えたDiscordユーティリティBotです。スラッシュコマンドを主インターフェースとしつつ、高速なダイスロール用に`r!`/`d!`プレフィックスコマンドにも対応しています。データ永続化はTurso（libSQL）、設定管理はCloudflare Pagesダッシュボードから行えます。

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
| `/setmod` | モデレーション設定（ログチャンネル・警告しきい値） |

### ダイス & TRPG

Nexusには2系統の独立したダイス機能と、成長中のTRPGルールエンジンがあります。すべて内部的に単一のFair Roller（`components/dice/engine.js`）を共有しています。

| コマンド | 説明 |
| --- | --- |
| `/dice`（レガシーモード） | `sides`/`count`/`modifier`/`buff`/`debuff`/`set`/`show_odds`による重み付けダイス |
| `/dice system:coc7 ...` | クトゥルフ神話TRPG 第7版の技能判定（1d100） |
| `/dice system:coc6 ...` | クトゥルフ神話TRPG 第6版の技能判定（1d100） |
| `/dice system:dnd5e ...` | D&D 5eのd20判定（通常/有利/不利） |
| `r!<式>` / `d!<式>` | Prefixダイス式。例: `r!2d6+1d4-3`（最大3グループ、加減算のみ） |
| `r!coc7 <目標値>` / `d!coc7 <目標値>` | CoC7版判定の短縮構文 |
| `r!coc6 <目標値>` / `d!coc6 <目標値>` | CoC6版判定の短縮構文 |
| `r!dnd <修正値> [adv\|dis]` | D&D5e判定の短縮構文 |

**設計上のポイント：**
- `buff`/`debuff`（重み付き乱数）とTRPGダイスは完全に分離されています。TRPG判定は常に公平な乱数（Fair Roller）を使用します。
- 複数Dice Groupのダイス式（`2d6+1d4-3d8`）は**Prefix専用**です。Slashの`/dice`には`expression`オプションはありません。
- 全角入力（`ｒ！２ｄ６`）はNFKC正規化により解析前に半角化されるため、スマートフォンのIME入力でも同様に動作します。
- `/dice-prefix mode` / `/dice-prefix channel` により、サーバー管理者が`r!`/`d!`を使用できるチャンネルを制限できます（モード: `all`/`selected`/`disabled`、チャンネル単位の`allow`/`deny`/`reset`、Threadは親チャンネル設定を継承）。

### ユーティリティ

| コマンド | 説明 |
| --- | --- |
| `/timer start` | タイマー開始（分・秒指定） |
| `/timer stop` | タイマー停止 |
| `/clear` | メッセージ一括削除（ユーザーフィルター対応） |
| `/poll` | 投票作成（匿名・複数選択・ロール制限対応） |
| `/afk set` | AFK設定 |
| `/afk list` | AFK一覧表示 |
| `/serverinfo` | サーバー情報表示 |
| `/userinfo` | ユーザー情報表示 |
| `/help` | コマンド一覧・詳細表示 |

### 時報

| コマンド | 説明 |
| --- | --- |
| `/sethourly set` | 時報チャンネルを設定 |
| `/sethourly unset` | 時報を解除 |

時間・曜日別のメッセージ（テキスト・Embed・画像・ファイル）はダッシュボードから設定します。

### 申請システム

| コマンド | 説明 |
| --- | --- |
| `!apply <内容> [コメント]` | 申請を送信（Prefixコマンド、設定済みチャンネルのみ） |
| `!revoke <ID>` | 申請を取り消し |
| `/apply-config` | 申請システムの設定（チャンネル・通知ロール/方法・管理者チャンネル・一覧表示・CSV出力） |

### 言語設定

| コマンド | 説明 |
| --- | --- |
| `/language` | **個人用**のBot返答言語を設定（`Auto`/`日本語`/`English`） |
| `/lang` | **サーバー全体**のデフォルト返答言語を設定（`サーバー管理`権限が必要） |

優先順位: **ユーザー手動設定 → サーバー手動設定 → Discordクライアントのlocale → 英語**。Slash CommandのUIローカライズ（Discord上に表示されるコマンド名・説明文）は`deploy-commands.js`側で別途処理されており、この返答言語ロジックとは独立しています。

## 技術スタック

| 項目 | 技術 |
| --- | --- |
| ランタイム | Node.js 20+（ESModule） |
| フレームワーク | discord.js v14 |
| データベース | Turso（libSQL） |
| ホスティング | GCP e2-micro |
| ダッシュボード | Cloudflare Pages + Workers |
| ライセンス | AGPL-3.0 |

## プロジェクト構成

```
DiscordBot-Nexus/
├── commands/                  # スラッシュコマンド定義（Adapter層）
│   ├── dice.js                 # /dice — レガシー + TRPGモード
│   ├── prefix.js                # /dice-prefix — r!/d!のチャンネル権限設定
│   ├── language.js / lang.js    # 個人/サーバーの言語設定
│   └── ...（モデレーション・ユーティリティ・apply-config等）
├── components/
│   ├── dice/
│   │   ├── parser.js            # 文字列 → terms[]（Dice Groupの解析のみ）
│   │   ├── validator.js         # 制限値検証（グループ数/個数/面数/修正値）
│   │   ├── engine.js            # Fair Roller — rollDie(sides, rng)
│   │   ├── formatter.js         # 結果terms[] → 表示テキスト
│   │   ├── odds.js              # 確率分布計算（単一グループ + buff/debuff）
│   │   └── index.js             # Prefix Adapterが使う共通エントリポイント
│   ├── trpg/
│   │   ├── registry.js          # TRPG_SYSTEMSマップ（coc7 / coc6 / dnd5e）
│   │   ├── validator.js         # TRPG入力検証
│   │   ├── coc7.js / coc6.js    # 純粋関数のRule。Dice Engineのrollを再利用
│   │   ├── dnd5e.js             # 同上
│   │   ├── formatter.js         # 詳細(Slash)/簡潔(Prefix) + システム横断ディスパッチ
│   │   ├── prefixSyntax.js      # r!coc7 / r!dnd 短縮構文パーサー
│   │   └── index.js             # 共通エントリポイント（performTrpgCheck）
│   └── prefix/
│       └── permission.js        # チャンネル権限判定（Guild mode + Override + Thread継承）
├── aspects/
│   ├── normalization.js         # NFKC正規化（全角→半角）
│   └── language.js              # utils/i18n.js の resolveLang の薄いラッパー
├── events/
│   ├── ready.js
│   ├── interactionCreate.js     # getLang(interaction)で言語解決し各コマンドへディスパッチ
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
├── deploy-commands.js            # コマンド登録 + description_localizationsの自動注入
├── Dockerfile
└── package.json
```

## DBテーブル

```
reminders              タイマー
afk                     AFK
warnings                警告
mod_notes               モデレーションメモ
mod_logs                モデレーションログ
mod_settings            モデレーション設定
settings                 サーバー設定
polls / poll_votes      投票
applications             申請
apply_settings           申請設定
guild_settings            ギルド設定（保持期間等）
hourly_messages          時報メッセージ
guild_lang / user_lang    言語設定（サーバー/個人）
guild_prefix_settings     サーバーごとのPrefixモード（all/selected/disabled）
prefix_channel_settings   チャンネルごとのPrefix個別設定（allow/deny）
```

## セットアップ

### 前提条件

- Node.js 20以上
- Tursoアカウント・データベース
- Discord Developer PortalでBotを作成済み
- Developer Portalで**Message Content Intent**を有効化済み（`!apply`/`!revoke`と`r!`/`d!`Prefixコマンドに必須）

### インストール

```bash
git clone https://github.com/OCxeRu2951/DiscordBot-Nexus.git
cd DiscordBot-Nexus
npm install
```

### 環境変数

`.env`ファイルをプロジェクトルートに作成します。

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_turso_token
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

## Prefixダイス早見表

```
r!2d6                  2d6を振る
d!2d6+1d4-3            最大3グループ、加減算のみ
r!coc7 60              CoC7版判定、技能値60
r!coc6 60              CoC6版判定、技能値60
r!dnd +5               D&D5e判定、修正値+5
r!dnd +5 adv           ...アドバンテージ付き
r!dnd +5 dis           ...ディスアドバンテージ付き
```

全角入力（`ｒ！２ｄ６`）も同様に動作します。チャンネルごとの使用可否は`/dice-prefix`で管理します。

## バージョンロードマップ

| バージョン | 内容 | 状態 |
| --- | --- | --- |
| v0.7.0 | 申請システム | 完了 |
| v0.8.0 | モデレーションスイート | 完了 |
| v0.9.0 | ダイス/TRPGエンジン（coc7・coc6・dnd5e）+ Prefix権限システム | 完了 |
| v0.10.0 | 他TRPGシステム追加（sw25・dx3）、Session/Recruitment連携 | 予定 |
| v1.0.0 | 正式リリース | 予定 |
| v2.0.0 | 有料プラン・Rust(serenity)移行開始 | 予定 |

## 関連サイト

- [Nexus管理ダッシュボード]()
- [Nexus公開情報ページ](https://nexus.ocxeru.com/install)

## 関連リポジトリ

- [Nexus Dashboard](https://github.com/OCxeRu2951/Nexus-Dashboard) — 管理ダッシュボード
- [Nexus Pages](https://github.com/OCxeRu2951/Nexus-Pages) — 公開情報ページ

## ライセンス

[AGPL-3.0](../LICENSE) © 2026 OCxeRu2951

本ソフトウェアはAGPL-3.0ライセンスの下で公開されています。改変・再配布の際はソースコードの公開が必要です。
