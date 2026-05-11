# Nexus — Discord Utility Bot

discord.js v14製のユーティリティBot。モデレーション・タイマー・投票・時報・申請システムなど多機能なオールインワンBot。

## 機能一覧

### ユーティリティ

| コマンド | 説明 |
| --- | --- |
| `/timer` | タイマー管理。start: 分・秒単位で設定 / stop: 停止 |
| `/clear` | メッセージ一括削除。特定ユーザー指定可能（要ManageMessages権限） |
| `/poll` | 投票作成。終了時間・匿名・複数選択・ロール制限・結果非通知に対応 |
| `/dice` | ダイスロール。バフ・デバフによる重み付き抽選・複数セット対応 |
| `/serverinfo` | サーバー情報を表示 |
| `/userinfo` | ユーザー情報を表示 |
| `/afk` | AFK管理。set: 設定 / list: 一覧表示。メンション時に自動返信・24時間で自動解除 |

### 時報

| コマンド | 説明 |
| --- | --- |
| `/sethourly` | 時報の設定。set: チャンネル設定 / unset: 解除 |

時報は毎時0分に設定チャンネルへ送信。`data/jsons/hourly.json` でメッセージ・Embed・画像・ファイル添付を時間ごとに設定可能。

### モデレーション

| コマンド | 説明 |
| --- | --- |
| `/warn` | 警告発行。ポイント制・しきい値で自動タイムアウト・BAN |
| `/warnings` | 警告履歴表示 |
| `/clearwarn` | 警告削除（個別 / 全削除） |
| `/kick` | キック |
| `/ban` | BAN（メッセージ削除日数指定可能） |
| `/unban` | BAN解除 |
| `/timeout` | タイムアウト（最大28日） |
| `/untimeout` | タイムアウト解除 |
| `/slowmode` | 低速モード設定・解除 |
| `/lock` | チャンネルロック・解除 |
| `/role` | ロール付与・剥奪 |
| `/note` | モデレーターノート管理（add / list / delete） |
| `/modhistory` | モデレーション履歴表示 |
| `/setmod` | モデレーション設定（ログチャンネル・警告しきい値） |
| `/language` | 言語を変更（実装途中） |

### 申請システム

| コマンド/コマンド | 説明 |
| --- | --- |
| `!apply <内容> <コメント>` | 申請を送信。IDを自動生成しDMで通知 |
| `!revoke <ID>` | 申請を取り消し |
| `/apply-config` | 申請システム設定（channel / operator / notify / admin / view / export） |

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し各値を入力する。

```bash
cp .env.example .env
```

| 変数 | 説明 |
| --- | --- |
| `DISCORD_TOKEN` | Bot Token（Discord Developer Portal > Bot） |
| `CLIENT_ID` | ApplicationのID（General Information） |
| `TURSO_URL` | TursoのDB URL |
| `TURSO_AUTH_TOKEN` | Tursoの認証トークン |

### 3. Slash Commandの登録

```bash
node deploy-commands.js
```

### 4. 起動

```bash
node index.js
```

---

## デプロイ

### GCP / Oracle Cloud / VPS（推奨）

```bash
# Node.js 20のインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# pm2のインストール
sudo npm install -g pm2

# リポジトリのクローン
git clone https://github.com/your-repo/nexus.git
cd nexus
npm install

# 環境変数・設定ファイルの作成
cp .env.example .env

# コマンド登録・起動
node deploy-commands.js
pm2 start index.js --name nexus
pm2 save
pm2 startup
```

### GitHub Actionsによる自動デプロイ

リポジトリのSecretsに以下を登録する。

| キー | 内容 |
| --- | --- |
| `GCP_HOST` または `ORACLE_HOST` | VMのパブリックIPアドレス |
| `GCP_USER` または `ORACLE_USER` | SSHユーザー名 |
| `GCP_SSH_KEY` または `ORACLE_SSH_KEY` | SSH秘密鍵 |

---

## ディレクトリ構成

```dir
nexus/
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Actions自動デプロイ
├── commands/
│   ├── timer.js             # タイマー（start / stop）
│   ├── clear.js             # メッセージ削除
│   ├── poll.js              # 投票
│   ├── dice.js              # ダイスロール
│   ├── serverinfo.js        # サーバー情報
│   ├── userinfo.js          # ユーザー情報
│   ├── afk.js               # AFK管理
│   ├── sethourly.js         # 時報設定
│   ├── warn.js              # 警告発行
│   ├── warnings.js          # 警告履歴
│   ├── clearwarn.js         # 警告削除
│   ├── kick.js              # キック
│   ├── ban.js               # BAN
│   ├── unban.js             # BAN解除
│   ├── timeout.js           # タイムアウト
│   ├── untimeout.js         # タイムアウト解除
│   ├── slowmode.js          # 低速モード
│   ├── lang.js              # 言語設定(実装中)
│   ├── lock.js              # チャンネルロック
│   ├── role.js              # ロール管理
│   ├── note.js              # ノート管理
│   ├── modhistory.js        # モデレーション履歴
│   ├── setmod.js            # モデレーション設定
│   └── apply-config.js      # 申請システム設定
├── events/
│   ├── guildCreate.js
│   ├── guildDelete.js
│   ├── ready.js             # 起動確認・時報・投票復元・クリーンアップ
│   ├── interactionCreate.js # Slash Command・ボタンハンドラー
│   └── messageCreate.js     # AFK検知・申請コマンド
├── utils/
│   ├── i18n.js
│   ├── modLog.js
│   ├── db.js                # DB接続・テーブル初期化
│   ├── modLog.js            # モデレーションログ・自動エスカレーション
│   └── applyExport.js       # 申請履歴エクスポート
├── data/
│   ├── jsons/lnag
│   │   ├── ja.json          # 各種設定（Git管理外）
│   │   └── en.json          # 各種設定サンプル
│   ├── images/              # 時報添付画像
│   └── other/               # その他添付ファイル
├── index.js                 # エントリポイント
├── deploy-commands.js       # Slash Command登録スクリプト
├── Dockerfile
├── .env.example
├── .gitignore
├── .dockerignore
├── LICENSE                  # AGPL-3.0
└── README.md
```

---

## ライセンス

[AGPL-3.0](LICENSE)

---
