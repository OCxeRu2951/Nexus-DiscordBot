# Nexus Bot

> Discord向けオールインワンユーティリティBot

[![Version](https://img.shields.io/badge/version-v0.7.0-f07830)](https://github.com/OCxeRu2951/DiscordBot-Nexus/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](../LICENSE)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865f2)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)

[English README](../README.md)

---

## 概要

Nexusはモデレーション・時報・投票・募集・ダイス/TRPGエンジン・申請システムを備えたDiscordユーティリティBotです。スラッシュコマンドを主インターフェースとしつつ、短いプレフィックスコマンド（申請用の`a!`/`r!`、高速ダイスロール用の`d!`、募集用の`b!`）にも対応しています。データ永続化はTurso（libSQL）、設定管理はCloudflare Pagesダッシュボードから行えます。

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
| `d!<式>` | Prefixダイス式。例: `d!2d6+1d4-3`（最大3グループ、加減算のみ） |
| `d!coc7 <目標値>` | CoC7版判定の短縮構文 |
| `d!coc6 <目標値>` | CoC6版判定の短縮構文 |
| `d!dnd <修正値> [adv\|dis]` | D&D5e判定の短縮構文 |

**設計上のポイント：**
- `buff`/`debuff`（重み付き乱数）とTRPGダイスは完全に分離されています。TRPG判定は常に公平な乱数（Fair Roller）を使用します。
- 複数Dice Groupのダイス式（`2d6+1d4-3d8`）は**Prefix専用**です。Slashの`/dice`には`expression`オプションはありません。
- ダイスのプレフィックスは`d!`のみです。`r!`は申請の取り消し専用です。
- すべてのプレフィックス（`a!`/`r!`/`d!`/`b!`）はNFKC正規化により全角・半角、大文字・小文字を区別せず判定されるため（`ｄ！２ｄ６`、`Ｄ!2d6`など）、スマートフォンのIME入力でも同様に動作します。
- `/dice-prefix mode` / `/dice-prefix channel` により、サーバー管理者が`d!`を使用できるチャンネルを制限できます（モード: `all`/`selected`/`disabled`、チャンネル単位の`allow`/`deny`/`reset`、Threadは親チャンネル設定を継承）。

### ユーティリティ

| コマンド | 説明 |
| --- | --- |
| `/timer start` | タイマー開始（分・秒指定） |
| `/timer stop` | タイマー停止 |
| `/clear` | メッセージ一括削除（ユーザーフィルター対応） |
| `/poll` | 投票作成（匿名・複数選択・ロール制限対応） |
| `/recruit` | 参加・取消・締切ボタン付きの募集を作成 |
| `/recruit-config mode:<list\|thread\|viewer\|show>` | 募集の設定（更新リストのチャンネル・スレッド/フォーラム・ダッシュボードの閲覧ロール・現在の設定の表示）。`サーバー管理`権限が必要 |
| `/afk set` | AFK設定 |
| `/afk list` | AFK一覧表示 |
| `/serverinfo` | サーバー情報表示 |
| `/userinfo` | ユーザー情報表示 |
| `/help` | コマンド一覧・詳細表示 |

### 募集

`/recruit title:<タイトル> [capacity:<1〜50>] [duration:<分>] [description:<詳細>] [mention:<ロール>] [thread:<True|False>]`

プレフィックス版:

```
b!<タイトル> [@人数] [締切] [スレなし]
<2行目以降は詳細>

b!ボドゲ会 @3 60分
b!APEX ランク @2 2時間
```

- `@人数`（`@3`、`＠３`、`@3人`）で定員、`30分`/`2時間`/`30m`/`2h`で締切、`スレなし`（`nothread`）でスレッドを作らない指定になります。いずれも1行目の独立した語として書いた場合のみ認識し、位置は自由です。
- 募集投稿は`b!`のメッセージへの返信として送られます。`b!`のメッセージに書いたロールメンションは通常どおり（本人の発言として）通知され、タイトルからは除外されます。

- **参加**/**取消**/**締切**ボタン付きのEmbedを投稿し、参加者一覧と人数をその場で更新します。
- 定員到達・締切時刻で自動的に締め切ります。募集者、または`メッセージの管理`権限を持つメンバーは手動で締め切れます。
- 締切時は募集投稿への返信として、募集者と参加者全員をメンションします。
- 定員判定はSQL 1文で行うため、同時に押されても定員を超えません。締切タイマーはBot再起動後も復元されます。
- `mention`は投稿時に1回だけロールを通知します。メンション不可のロールと`@everyone`には`@everyone、@here、全てのロールにメンション`権限が必要です。
- 締め切った募集は30日後に削除されます。

**スレッド / フォーラム** — 募集ごとに既定でスレッドを作成します（`thread:False` / `スレなし` で作成しない）。`/recruit-config mode:thread type:<Thread|Forum> [forum:<チャンネル>]` で「募集投稿からスレッドを作成」か「フォーラムチャンネルに投稿」かを選べます（フォーラム投稿に失敗した場合はスレッドで代替）。募集者と、参加ボタンを押したメンバーは自動でスレッドに追加され、締切後もスレッドは残ります。

**更新リスト** — `/recruit-config mode:list channel:<チャンネル>` で、そのチャンネルに募集中の一覧を1つの投稿として置きます（タイトルは募集投稿へのリンク、人数・締切・募集者・スレッド/フォーラムのリンク付き）。募集の作成・参加・取消・締切のたびに同じ投稿を編集して更新し、短時間の連続操作は1回にまとめます。投稿が削除された場合は作り直します。

**ダッシュボード** — サーバー管理者はすべての募集の閲覧・締切と上記の設定ができます。それ以外のメンバーは、Discord上で閲覧できるチャンネルの募集を閲覧でき、自分の募集を締め切れます（`メッセージの管理`権限があれば他人の募集も可）。`/recruit-config mode:viewer action:<Add|Remove|Reset> role:<ロール>` で閲覧できるロールを限定できます（既定は全員）。ダッシュボードからの締切はBotが数秒以内に実行するため、投稿の更新と参加者への通知はボタンで締め切った場合と同じです。

スレッドに必要なBotの権限: `公開スレッドの作成`・`スレッドでメッセージを送信`（フォーラム方式ではフォーラムチャンネルでの`メッセージを送信`）。

### 時報

| コマンド | 説明 |
| --- | --- |
| `/sethourly set` | 時報チャンネルを設定 |
| `/sethourly unset` | 時報を解除 |

時間・曜日別のメッセージ（テキスト・Embed・画像・ファイル）はダッシュボードから設定します。

### 申請システム

| コマンド | 説明 |
| --- | --- |
| `a!<内容>` | 申請を送信（設定済みチャンネルのみ。`a!`以降がすべて申請内容） |
| `r!<ID>` | 申請を取り消し |
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
│   ├── prefix.js                # /dice-prefix — d!のチャンネル権限設定
│   ├── recruit.js               # /recruit — 募集投稿
│   ├── recruit-config.js        # /recruit-config — 更新リスト・スレッド・閲覧ロールの設定
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
│   │   ├── prefixSyntax.js      # d!coc7 / d!dnd 短縮構文パーサー
│   │   └── index.js             # 共通エントリポイント（performTrpgCheck）
│   ├── prefix/
│   │   └── permission.js        # チャンネル権限判定（Guild mode + Override + Thread継承）
│   └── recruit/
│       ├── index.js             # 募集のDB操作・Embed/ボタン生成・締切タイマー・ボタン処理
│       ├── list.js              # 更新リスト（1つの投稿をまとめて更新）
│       ├── thread.js            # スレッド/フォーラム投稿の作成・参加者の追加
│       ├── actions.js           # ダッシュボードからの依頼（締切・リスト更新）の実行
│       ├── settings.js          # recruit_settings の読み書き
│       └── prefixSyntax.js      # b! 構文パーサー + 共通の上限値
├── aspects/
│   ├── normalization.js         # NFKC正規化 + 全角半角・大小文字を問わないPrefix判定
│   └── language.js              # utils/i18n.js の resolveLang の薄いラッパー
├── events/
│   ├── ready.js
│   ├── interactionCreate.js     # getLang(interaction)で言語解決し各コマンドへディスパッチ
│   ├── messageCreate.js         # a!/r! 申請 + d! ダイス + b! 募集
│   ├── guildCreate.js
│   └── guildDelete.js
├── utils/
│   ├── db.js
│   ├── modLog.js
│   ├── applyExport.js
│   ├── guildCleanup.js          # 退出したサーバーの30日後削除キュー
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
recruits / recruit_members  募集と参加者
recruit_settings          更新リストのチャンネル・スレッド方式・ダッシュボードの閲覧ロール
recruit_actions           ダッシュボードからの依頼（Botが処理）
guild_deletion_queue      サーバーデータの削除予約
```

Nexusがサーバーから削除されると、そのサーバーのデータは30日間保持された後、サーバー単位のすべてのテーブルから削除されます。30日以内に再導入した場合は削除予約が取り消されます。Botの停止中に削除されたサーバーも、起動時に検出して削除予約に登録します。

## セットアップ

### 前提条件

- Node.js 20以上
- Tursoアカウント・データベース
- Discord Developer PortalでBotを作成済み
- Developer Portalで**Message Content Intent**を有効化済み（`a!`/`r!`/`d!`/`b!`プレフィックスコマンドに必須）

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
d!2d6                  2d6を振る
d!2d6+1d4-3            最大3グループ、加減算のみ
d!coc7 60              CoC7版判定、技能値60
d!coc6 60              CoC6版判定、技能値60
d!dnd +5               D&D5e判定、修正値+5
d!dnd +5 adv           ...アドバンテージ付き
d!dnd +5 dis           ...ディスアドバンテージ付き
```

全角入力（`ｄ！２ｄ６`）も同様に動作します。`r!`はダイスには使えなくなりました。チャンネルごとの使用可否は`/dice-prefix`で管理します。

## バージョンロードマップ

| バージョン | 内容 | 状態 |
| --- | --- | --- |
| v0.7.0 | 申請システム | 完了 |
| v0.8.0 | モデレーションスイート | 完了 |
| v0.9.0 | ダイス/TRPGエンジン（coc7・coc6・dnd5e）+ Prefix権限システム | 完了 |
| v0.10.0 | 募集（`/recruit`・`b!`）+ プレフィックス再設計（`a!`/`r!`/`d!`） | 完了 |
| v0.11.0 | 他TRPGシステム追加（sw25・dx3）、Session連携 | 予定 |
| v1.0.0 | 正式リリース | 予定 |
| v2.0.0 | 有料プラン・Rust(serenity)移行開始 | 予定 |

## 関連リポジトリ

- [Nexus Dashboard](https://github.com/OCxeRu2951/Nexus-Dashboard) — 管理ダッシュボード
- [Nexus Pages](https://github.com/OCxeRu2951/Nexus-Pages) — 公開情報ページ

## ライセンス

[AGPL-3.0](../LICENSE) © 2026 OCxeRu2951

本ソフトウェアはAGPL-3.0ライセンスの下で公開されています。改変・再配布の際はソースコードの公開が必要です。
