import { scheduleGuildDeletion } from "../utils/guildCleanup.js";

export default {
  name: "guildDelete",
  async execute(guild) {
    console.log(`Left guild: ${guild.name} (${guild.id})`);

    // 即時削除はせず、30日後に完全削除する予約だけを入れる。
    // 猶予期間中に再参加した場合は guildCreate.js が予約をキャンセルする。
    await scheduleGuildDeletion(guild.id);

    console.log(`Scheduled data deletion for guild: ${guild.id} (in 30 days)`);
  },
};
