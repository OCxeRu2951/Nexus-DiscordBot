# Discord Utility Bot

discord.js v14製のユーティリティBot。

## 機能一覧

| コマンド | 説明 |
|---|---|
| `/timer` | 指定時間後にメンション通知。start: 開始 / stop: 停止。分・秒単位で設定可能 |
| `/clear` | メッセージ一括削除。特定ユーザーのメッセージのみ指定可能（要ManageMessages権限） |
| `/poll` | 絵文字リアクション投票を作成。終了時間・匿名・複数選択・ロール制限・結果非通知に対応 |
| `/serverinfo` | サーバー情報を表示 |
| `/userinfo` | ユーザー情報を表示 |
| `/afk` | AFK管理。set: 設定 / list: 一覧表示。メンション時に自動返信 |
| `/sethourly` | 時報の設定。set: チャンネル設定 / unset: 解除 |

時報は毎時0分に `/sethourly set` で設定したチャンネルへ送信。メッセージ・Embed・画像・ファイル添付を `data/jsons/hourly.json` で設定可能。

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、各値を埋める。

```bash
cp .env.example .env
```

- `DISCORD_TOKEN`: Bot Token（Discord Developer Portal > Bot）
- `CLIENT_ID`: ApplicationのID（General Information）
- `GUILD_ID`: サーバーのID。カンマ区切りで複数指定可能（例: `111,222`）
- `TURSO_URL`: TursoのDB URL
- `TURSO_AUTH_TOKEN`: Tursoの認証トークン

### 3. 設定ファイルの作成

```bash
cp data/jsons/hourly.example.json data/jsons/hourly.json
cp data/jsons/setting.example.json data/jsons/setting.json
```

**`hourly.json`** — 時報メッセージの設定。キーは時間（0〜23）、`default` は `null` にすると指定時間のみ送信。

| フィールド | 説明 |
|---|---|
| `content` | テキストメッセージ |
| `embed` | Embedの設定（title / description / color / footer / image / thumbnail） |
| `image` | 画像URL（embedなしの場合に単体で表示） |
| `file` | `data/images/` 内の画像ファイル名、または `data/other/` 内のファイル名 |

`{hour}` `{minute}` はプレースホルダーとして送信時に置換される。

**`setting.json`** — 各種設定。

| フィールド | 説明 | デフォルト |
|---|---|---|
| `afk_hours` | AFK自動解除までの時間 | 24 |
| `poll_days` | 投票データの保持日数 | 7 |
| `warnings_days` | 警告データの保持日数 | 90 |

### 4. Slash Commandの登録

```bash
node deploy-commands.js
```

### 5. 起動

```bash
node index.js
```

---

## fly.io へのデプロイ

```bash
fly launch --no-deploy
fly secrets set DISCORD_TOKEN=xxx CLIENT_ID=xxx GUILD_ID=xxx TURSO_URL=xxx TURSO_AUTH_TOKEN=xxx
fly deploy
```

GitHub Actionsによる自動デプロイを使用する場合は、リポジトリのSecretsに `FLY_API_TOKEN` を登録する。

```bash
fly tokens create deploy -x 999999h
```

---

## ディレクトリ構成

```directory
discord-bot/
├── .github/workflows
│   └── fly-deploy.yml       # GitHub Actions自動デプロイ
├── index.js                 # エントリポイント
├── deploy-commands.js       # Slash Command登録スクリプト
├── fly.toml                 # fly.io設定
├── Dockerfile
├── package.json
├── .env.example
├── .gitignore
├── .dockerignore
├── README.md
├── commands/
│   ├── timer.js             # タイマー
│   ├── clear.js             # メッセージ削除
│   ├── poll.js              # 投票
│   ├── serverinfo.js        # サーバー情報
│   ├── userinfo.js          # ユーザー情報
│   ├── afk.js               # AFK管理
│   └── sethourly.js         # 時報設定
├── events/
│   ├── ready.js             # 起動確認・時報・投票復元・クリーンアップ
│   ├── interactionCreate.js # Slash Commandハンドラー
│   └── messageCreate.js     # AFK検知
├── utils/
│   └── db.js                # DB接続・テーブル初期化
└── data/
    ├── jsons/
    │   ├── hourly.example.json  # 時報メッセージのサンプル
    │   └── setting.example.json # 設定のサンプル
    ├── images/                  # 時報添付画像
    └── other/                   # その他添付ファイル
```
