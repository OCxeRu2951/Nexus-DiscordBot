/**
 * Language Resolution Aspect
 * ------------------------------------------------------------
 * 既存の utils/i18n.js に実装済みの言語優先順位ロジック
 * （ユーザー手動設定 → サーバー手動設定 → Discord locale → en）を
 * Dice Core からも呼びやすい形で薄くラップしたもの。
 *
 * Slash:  resolveLanguage({ userId: interaction.user.id, guildId: interaction.guildId, locale: interaction.locale })
 * Prefix: resolveLanguage({ userId: message.author.id,  guildId: message.guildId,  locale: null })
 */
import { resolveLang } from "../utils/i18n.js";

export async function resolveLanguage({ userId = null, guildId = null, locale = null } = {}) {
  return resolveLang({ userId, guildId, locale });
}
