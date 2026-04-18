import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../utils/db.js";

const EMOJI_NUMBERS = [
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
  "6️⃣",
  "7️⃣",
  "8️⃣",
  "9️⃣",
  "🔟",
];

export default {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("投票を作成します")
    .addStringOption((opt) =>
      opt.setName("question").setDescription("質問内容").setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("choices")
        .setDescription(
          "選択肢をカンマ区切りで入力（例: はい,いいえ,どちらでも）",
        )
        .setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("duration")
        .setDescription("投票時間（分）。省略時は無期限")
        .setRequired(false)
        .setMinValue(1),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("anonymous")
        .setDescription("匿名投票にするか（デフォルト: false）")
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("max_choices")
        .setDescription("1人が選択できる最大数（デフォルト: 1）")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10),
    )
    .addRoleOption((opt) =>
      opt
        .setName("required_role")
        .setDescription("投票できるロールを限定する")
        .setRequired(false),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("hide_results")
        .setDescription("終了時に結果を通知しない（デフォルト: false）")
        .setRequired(false),
    ),

  async execute(interaction, client) {
    const question = interaction.options.getString("question");
    const rawChoices = interaction.options.getString("choices");
    const duration = interaction.options.getInteger("duration") ?? null;
    const anonymous = interaction.options.getBoolean("anonymous") ?? false;
    const maxChoices = interaction.options.getInteger("max_choices") ?? 1;
    const requiredRole = interaction.options.getRole("required_role") ?? null;
    const hideResults = interaction.options.getBoolean("hide_results") ?? false;

    const choices = rawChoices
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (choices.length < 2) {
      return interaction.reply({
        content: "選択肢は2つ以上入力してください。",
        ephemeral: true,
      });
    }

    const endAt = duration ? Date.now() + duration * 60 * 1000 : null;

    const lines = choices.map((c, i) => `${EMOJI_NUMBERS[i]} ${c}`).join("\n");
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${question}`)
      .setDescription(lines)
      .setColor(0x5865f2)
      .setFooter({
        text: [
          `by ${interaction.user.username}`,
          anonymous ? "匿名投票" : null,
          maxChoices > 1 ? `最大${maxChoices}択` : null,
          requiredRole ? `対象: ${requiredRole.name}` : null,
          endAt
            ? `終了: ${new Date(endAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`
            : "無期限",
        ]
          .filter(Boolean)
          .join(" | "),
      })
      .setTimestamp();

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

    // リアクション追加（匿名でない場合）
    if (!anonymous) {
      for (let i = 0; i < choices.length; i++) {
        await msg.react(EMOJI_NUMBERS[i]);
      }
    }

    // DBに保存
    await db.execute({
      sql: `INSERT INTO polls (message_id, channel_id, guild_id, question, choices, end_at, anonymous, max_choices, required_role, hide_results)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        msg.id,
        interaction.channelId,
        interaction.guildId,
        question,
        JSON.stringify(choices),
        endAt,
        anonymous ? 1 : 0,
        maxChoices,
        requiredRole?.id ?? null,
        hideResults ? 1 : 0,
      ],
    });

    // 終了タイマーをセット
    if (endAt) {
      schedulePollEnd(client, {
        id: null, // DBのIDは後で取得
        message_id: msg.id,
        channel_id: interaction.channelId,
        question,
        choices: JSON.stringify(choices),
        end_at: endAt,
        hide_results: hideResults ? 1 : 0,
      });
    }
  },
};

export async function schedulePollEnd(client, poll) {
  const delay = Number(poll.end_at) - Date.now();
  if (delay <= 0) {
    await finishPoll(client, poll);
    return;
  }

  setTimeout(async () => {
    await finishPoll(client, poll);
  }, delay);
}

async function finishPoll(client, poll) {
  try {
    const channel = client.channels.cache.get(poll.channel_id);
    if (!channel) return;

    const msg = await channel.messages.fetch(poll.message_id).catch(() => null);
    if (!msg) return;

    // 元のEmbedに終了を追記
    const oldEmbed = msg.embeds[0];
    const closedEmbed = EmbedBuilder.from(oldEmbed)
      .setColor(0x95a5a6)
      .setFooter({ text: (oldEmbed.footer?.text ?? "") + " | 投票終了" });
    await msg.edit({ embeds: [closedEmbed] });

    // 結果通知（hide_resultsがfalseの場合）
    if (!poll.hide_results) {
      const choices = JSON.parse(poll.choices);
      const reactions = msg.reactions.cache;

      const results = choices.map((choice, i) => {
        const reaction = reactions.get(EMOJI_NUMBERS[i]);
        const count = reaction ? reaction.count - 1 : 0; // Bot自身のリアクションを除く
        return { choice, count, emoji: EMOJI_NUMBERS[i] };
      });

      const total = results.reduce((sum, r) => sum + r.count, 0);
      const resultLines = results
        .sort((a, b) => b.count - a.count)
        .map((r) => {
          const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
          const bar =
            "█".repeat(Math.round(pct / 10)) +
            "░".repeat(10 - Math.round(pct / 10));
          return `${r.emoji} **${r.choice}**\n${bar} ${r.count}票 (${pct}%)`;
        })
        .join("\n\n");

      const resultEmbed = new EmbedBuilder()
        .setTitle(`📊 投票結果: ${poll.question}`)
        .setDescription(resultLines || "投票なし")
        .setColor(0x2ecc71)
        .setFooter({ text: `総投票数: ${total}` })
        .setTimestamp();

      await channel.send({ embeds: [resultEmbed] });
    }

    // DBから削除
    await db.execute({
      sql: `DELETE FROM polls WHERE message_id = ?`,
      args: [poll.message_id],
    });
  } catch (err) {
    console.error("Failed to finish poll:", err);
  }
}
