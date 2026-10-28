/**
 * Role Hierarchy
 * ------------------------------------------------------------
 * モデレーション系コマンドで、実行者が対象より上位かを判定する。
 * Botの権限で実行するため、Discord本体と同じ序列の制限をここで掛けないと、
 * 下位のモデレーターが上位のメンバーを処分したり、上位のロールを付与できてしまう。
 *
 *   - サーバーオーナーは常に最上位（オーナーを対象にはできない）
 *   - 最上位ロールが同じ位置の場合は実行できない（Discord本体と同じ）
 */

/**
 * @param {import("discord.js").GuildMember} executor
 * @param {import("discord.js").GuildMember} target
 */
export function outranks(executor, target) {
  if (!executor || !target) return false;
  const ownerId = executor.guild.ownerId;
  if (target.id === ownerId) return false;
  if (executor.id === ownerId) return true;
  return executor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

/**
 * @param {import("discord.js").GuildMember} executor
 * @param {import("discord.js").Role} role
 */
export function canManageRole(executor, role) {
  if (!executor || !role) return false;
  if (executor.id === executor.guild.ownerId) return true;
  return executor.roles.highest.comparePositionTo(role) > 0;
}

/**
 * interaction.member は通常 GuildMember だが、キャッシュ状況によってはAPIの生データになるため取り直す。
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 */
export async function getExecutor(interaction) {
  const member = interaction.member;
  if (member?.roles?.highest) return member;
  return interaction.guild.members.fetch(interaction.user.id).catch(() => null);
}
