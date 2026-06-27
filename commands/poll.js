import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { db } from "../utils/db.js";
import { t } from "../utils/i18n.js";

// ---- 投票Embedを更新 ----
async function updatePollEmbed(message, pollId, choices, lang) {
  const { rows: voteRows } = await db.execute({
    sql:  `SELECT choice, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY choice`,
    args: [pollId],
  }).catch(() => ({ rows: [] }));

  const counts = Object.fromEntries(voteRows.map(r => [r.choice, Number(r.count)]));
  const total  = voteRows.reduce((s, r) => s + Number(r.count), 0);

  const embed = EmbedBuilder.from(message.embeds[0]);
  embed.setFields(
    choices.map((choice, i) => {
      const count  = counts[i] ?? 0;
      const pct    = total > 0 ? Math.round((count / total) * 100) : 0;
      const filled = Math.round(pct / 10);
      const bar    = "█".repeat(filled) + "░".repeat(10 - filled);
      const voteLabel = lang === "ja" ? "票" : " votes";
      return {
        name:   `${i + 1}. ${choice}`,
        value:  `${bar} ${pct}% (${count}${voteLabel})`,
        inline: false,
      };
    }),
  );

  await message.edit({ embeds: [embed] }).catch(() => {});
}

// ---- 外部からタイマー復元で呼ばれる ----
export function schedulePollEnd(client, row) {
  const remaining = Number(row.end_at) - Date.now();
  if (remaining <= 0) {
    endPoll(client, row).catch(console.error);
    return;
  }
  setTimeout(() => endPoll(client, row).catch(console.error), remaining);
}

async function endPoll(client, row) {
  const channel = client.channels.cache.get(row.channel_id);
  if (!channel) return;

  const message = await channel.messages.fetch(row.message_id).catch(() => null);
  if (!message) return;

  const { rows: voteRows } = await db.execute({
    sql:  `SELECT choice, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY choice`,
    args: [row.id],
  }).catch(() => ({ rows: [] }));

  const choices = JSON.parse(row.choices);
  const counts  = Object.fromEntries(voteRows.map((r) => [r.choice, Number(r.count)]));
  const total   = voteRows.reduce((s, r) => s + Number(r.count), 0);

  const lang = "ja";

  const resultEmbed = new EmbedBuilder()
    .setTitle(t(lang, "commands.poll.result_title", { question: row.question }))
    .setColor(0x5865f2)
    .setFooter({ text: t(lang, "commands.poll.result_footer", { total }) })
    .setTimestamp();

  for (let i = 0; i < choices.length; i++) {
    const count = counts[i] ?? 0;
    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
    const bar   = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
    resultEmbed.addFields({
      name:   choices[i],
      value:  `${bar} ${pct}% (${count}票)`,
      inline: false,
    });
  }

  await message.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});
  await channel.send({ embeds: [resultEmbed] }).catch(() => {});

  await db.execute({
    sql:  `UPDATE polls SET end_at = NULL WHERE id = ?`,
    args: [row.id],
  }).catch(() => {});
}

// ---- 投票ボタンハンドラ（interactionCreate.js からエクスポート） ----
export async function handlePollVote(interaction, lang) {
  // customId: poll_vote_{pollId}_{choiceIdx}
  const parts     = interaction.customId.split("_");
  const pollId    = Number(parts[2]);
  const choiceIdx = Number(parts[3]);

  // Poll取得
  const { rows: pollRows } = await db.execute({
    sql:  `SELECT * FROM polls WHERE id = ?`,
    args: [pollId],
  });

  if (pollRows.length === 0) {
    return interaction.reply({
      content:   t(lang, "commands.poll.vote_not_found"),
      ephemeral: true,
    });
  }

  const poll    = pollRows[0];
  const choices = JSON.parse(poll.choices);

  // 終了チェック
  if (poll.end_at && Number(poll.end_at) < Date.now()) {
    return interaction.reply({
      content:   t(lang, "commands.poll.vote_ended"),
      ephemeral: true,
    });
  }

  // ロールチェック
  if (poll.required_role) {
    const member = interaction.guild.members.cache.get(interaction.user.id)
      ?? await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member?.roles.cache.has(poll.required_role)) {
      return interaction.reply({
        content:   t(lang, "commands.poll.vote_role"),
        ephemeral: true,
      });
    }
  }

  // 既存の投票を取得
  const { rows: existingVotes } = await db.execute({
    sql:  `SELECT * FROM poll_votes WHERE poll_id = ? AND user_id = ?`,
    args: [pollId, interaction.user.id],
  });

  const votedChoices = existingVotes.map(v => Number(v.choice));

  // 同じ選択肢に再投票 → 取り消し
  if (votedChoices.includes(choiceIdx)) {
    await db.execute({
      sql:  `DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ? AND choice = ?`,
      args: [pollId, interaction.user.id, choiceIdx],
    });

    await interaction.reply({
      content:   t(lang, "commands.poll.vote_removed"),
      ephemeral: true,
    });

    if (!poll.hide_results) {
      await updatePollEmbed(interaction.message, pollId, choices, lang);
    }
    return;
  }

  // max_choices = 1 の場合は既存票を置き換え
  if (Number(poll.max_choices) === 1 && votedChoices.length >= 1) {
    await db.execute({
      sql:  `DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?`,
      args: [pollId, interaction.user.id],
    });
  }
  // max_choices > 1 かつ上限に達している場合はエラー
  else if (votedChoices.length >= Number(poll.max_choices)) {
    return interaction.reply({
      content:   t(lang, "commands.poll.vote_max", { max: poll.max_choices }),
      ephemeral: true,
    });
  }

  // 投票を記録
  await db.execute({
    sql:  `INSERT INTO poll_votes (poll_id, user_id, choice, voted_at) VALUES (?, ?, ?, ?)`,
    args: [pollId, interaction.user.id, choiceIdx, Date.now()],
  });

  // 返信
  const replyContent = poll.anonymous
    ? t(lang, "commands.poll.vote_anonymous")
    : t(lang, "commands.poll.vote_success", { choice: choices[choiceIdx] });

  await interaction.reply({ content: replyContent, ephemeral: true });

  // Embed更新（hide_resultsでなければ）
  if (!poll.hide_results) {
    await updatePollEmbed(interaction.message, pollId, choices, lang);
  }
}

// ---- コマンド本体 ----
export default {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a poll")
    .addStringOption((opt) =>
      opt.setName("question").setDescription("Question").setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("choices").setDescription("Choices separated by commas (min 2)").setRequired(true),
    )
    .addBooleanOption((opt) =>
      opt.setName("anonymous").setDescription("Anonymous voting").setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt.setName("max_choices").setDescription("Max choices per user").setRequired(false).setMinValue(1),
    )
    .addRoleOption((opt) =>
      opt.setName("role").setDescription("Restrict to role").setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt.setName("duration").setDescription("Duration in minutes").setRequired(false).setMinValue(1),
    )
    .addBooleanOption((opt) =>
      opt.setName("hide_results").setDescription("Hide results until poll ends").setRequired(false),
    ),

  async execute(interaction, client, lang) {
    const question    = interaction.options.getString("question");
    const choicesRaw  = interaction.options.getString("choices");
    const anonymous   = interaction.options.getBoolean("anonymous")   ?? false;
    const maxChoices  = interaction.options.getInteger("max_choices") ?? 1;
    const role        = interaction.options.getRole("role");
    const duration    = interaction.options.getInteger("duration");
    const hideResults = interaction.options.getBoolean("hide_results") ?? false;

    const choices = choicesRaw.split(",").map((c) => c.trim()).filter(Boolean);

    if (choices.length < 2) {
      return interaction.reply({
        content:   t(lang, "commands.poll.min_choices"),
        ephemeral: true,
      });
    }

    const endAt = duration ? Date.now() + duration * 60 * 1000 : null;

    // フッター組み立て
    const footerParts = [];
    if (anonymous)      footerParts.push(t(lang, "commands.poll.footer_anonymous"));
    if (maxChoices > 1) footerParts.push(t(lang, "commands.poll.footer_max",      { max: maxChoices }));
    if (role)           footerParts.push(t(lang, "commands.poll.footer_role",     { role: role.name }));
    if (endAt) {
      const endTime = new Date(endAt).toLocaleString(lang === "ja" ? "ja-JP" : "en-US", { timeZone: "Asia/Tokyo" });
      footerParts.push(t(lang, "commands.poll.footer_deadline", { time: endTime }));
    } else {
      footerParts.push(t(lang, "commands.poll.footer_unlimited"));
    }

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${question}`)
      .setColor(0x5865f2)
      .setFooter({ text: footerParts.join(" | ") })
      .setTimestamp();

    for (let i = 0; i < choices.length; i++) {
      embed.addFields({ name: `${i + 1}. ${choices[i]}`, value: "░░░░░░░░░░ 0%", inline: false });
    }

    // ボタン生成（最大5個/行、25個まで）
    const rows = [];
    for (let i = 0; i < Math.min(choices.length, 25); i += 5) {
      const rowBuilder = new ActionRowBuilder();
      for (let j = i; j < Math.min(i + 5, choices.length); j++) {
        rowBuilder.addComponents(
          new ButtonBuilder()
            .setCustomId(`poll_vote_${j}`)
            .setLabel(`${j + 1}. ${choices[j].slice(0, 20)}`)
            .setStyle(ButtonStyle.Secondary),
        );
      }
      rows.push(rowBuilder);
    }

    await interaction.deferReply();
    const msg = await interaction.fetchReply();

    // DB保存
    const result = await db.execute({
      sql:  `INSERT INTO polls (guild_id, channel_id, message_id, question, choices, anonymous, max_choices, required_role, end_at, hide_results, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        interaction.guildId,
        interaction.channelId,
        msg.id,
        question,
        JSON.stringify(choices),
        anonymous   ? 1 : 0,
        maxChoices,
        role?.id    ?? null,
        endAt,
        hideResults ? 1 : 0,
        interaction.user.id,
      ],
    });

    const pollId = Number(result.lastInsertRowid);

    // ボタンのcustomIdにpollIdを付与して更新
    const updatedRows = rows.map((row) => {
      const newRow = new ActionRowBuilder();
      for (const btn of row.components) {
        const [, , choiceIdx] = btn.data.custom_id.split("_");
        newRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`poll_vote_${pollId}_${choiceIdx}`)
            .setLabel(btn.data.label)
            .setStyle(ButtonStyle.Secondary),
        );
      }
      return newRow;
    });

    await interaction.editReply({ embeds: [embed], components: updatedRows });

    // タイマー設定
    if (endAt) {
      const pollRow = {
        id: pollId,
        guild_id: interaction.guildId,
        channel_id: interaction.channelId,
        message_id: msg.id,
        question,
        choices: JSON.stringify(choices),
        end_at: endAt,
        anonymous: anonymous ? 1 : 0,
        max_choices: maxChoices,
        required_role: role?.id ?? null,
        hide_results: hideResults ? 1 : 0,
        created_by: interaction.user.id,
      };
      schedulePollEnd(client, pollRow);
    }
  },
};