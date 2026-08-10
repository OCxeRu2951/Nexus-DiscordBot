/**
 * Prefix Permission Component
 * 責務: 指定チャンネルで Prefix Command (r! / d!) を実行してよいかどうかの
 * 判定だけを行う。Discordへの返信・DB以外の処理は行わない。
 *
 * 判定優先順位:
 *   1. Guild mode が "disabled" → 常に不可（channel allowより優先）
 *   2. Channel Override（対象チャンネル自身）
 *   3. Thread の場合、親チャンネルの Channel Override
 *   4. Guild Mode ("all" → 許可 / "selected" → 不可)
 *
 * guild_prefix_settings に行が存在しない場合のデフォルトは "all"
 * （既存の /dice スラッシュコマンドと同様、追加設定なしでは制限しない挙動）。
 */
import { db } from "../../utils/db.js";

export const PREFIX_MODES = ["all", "selected", "disabled"];
export const CHANNEL_PERMISSIONS = ["allow", "deny"];
const DEFAULT_MODE = "all";

export async function getGuildPrefixMode(guildId) {
  if (!guildId) return DEFAULT_MODE;
  try {
    const { rows } = await db.execute({
      sql: `SELECT mode FROM guild_prefix_settings WHERE guild_id = ?`,
      args: [guildId],
    });
    return rows[0]?.mode ?? DEFAULT_MODE;
  } catch (error) {
    console.error("[prefix] Failed to get guild prefix mode:", error);
    return DEFAULT_MODE;
  }
}

export async function setGuildPrefixMode(guildId, mode) {
  if (!PREFIX_MODES.includes(mode)) {
    throw new Error(`Invalid prefix mode: ${mode}`);
  }
  await db.execute({
    sql: `INSERT INTO guild_prefix_settings (guild_id, mode) VALUES (?, ?)
          ON CONFLICT(guild_id) DO UPDATE SET mode = ?`,
    args: [guildId, mode, mode],
  });
}

export async function getChannelPrefixSetting(guildId, channelId) {
  if (!guildId || !channelId) return null;
  try {
    const { rows } = await db.execute({
      sql: `SELECT permission FROM prefix_channel_settings WHERE guild_id = ? AND channel_id = ?`,
      args: [guildId, channelId],
    });
    return rows[0]?.permission ?? null;
  } catch (error) {
    console.error("[prefix] Failed to get channel prefix setting:", error);
    return null;
  }
}

export async function setChannelPrefixSetting(guildId, channelId, permission) {
  if (!CHANNEL_PERMISSIONS.includes(permission)) {
    throw new Error(`Invalid channel permission: ${permission}`);
  }
  await db.execute({
    sql: `INSERT INTO prefix_channel_settings (guild_id, channel_id, permission) VALUES (?, ?, ?)
          ON CONFLICT(guild_id, channel_id) DO UPDATE SET permission = ?`,
    args: [guildId, channelId, permission, permission],
  });
}

// "reset" / "unset": 個別設定を削除しGuild全体設定へ戻す
export async function clearChannelPrefixSetting(guildId, channelId) {
  await db.execute({
    sql: `DELETE FROM prefix_channel_settings WHERE guild_id = ? AND channel_id = ?`,
    args: [guildId, channelId],
  });
}

/**
 * 指定チャンネル（Threadの場合はparentChannelIdも考慮）でPrefixが使用可能か判定する。
 *
 * @param {string} guildId
 * @param {string} channelId 実際に投稿されたチャンネル/ThreadのID
 * @param {string|null} parentChannelId Threadの場合の親チャンネルID（通常チャンネルならnull）
 * @returns {Promise<boolean>}
 */
export async function isPrefixAllowed(guildId, channelId, parentChannelId = null) {
  if (!guildId || !channelId) return false;

  const mode = await getGuildPrefixMode(guildId);

  // disabled は Channel Override より優先して常に不可
  if (mode === "disabled") return false;

  // 1. 対象チャンネル自身のOverride
  let override = await getChannelPrefixSetting(guildId, channelId);

  // 2. Threadの場合、個別設定がなければ親チャンネルのOverrideを見る
  if (override === null && parentChannelId) {
    override = await getChannelPrefixSetting(guildId, parentChannelId);
  }

  if (override === "allow") return true;
  if (override === "deny") return false;

  // 3. Guild Mode（Overrideが unset の場合のデフォルト）
  if (mode === "all") return true;
  if (mode === "selected") return false;

  return false;
}
