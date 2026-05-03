const cron = require("node-cron");
const db = require("../models");
const aiService = require("../services/aiService");

// ------------------------------------------------------------------
// How it works:
//   1. Every N minutes (configurable via CHAT_SUMMARIZE_CRON_EXPR)
//      the cron fires and looks at every user's chat messages.
//   2. If a user has more than CHAT_SUMMARIZE_THRESHOLD messages
//      (default 30), we take the oldest batch (everything except the
//      most recent CHAT_KEEP_RECENT messages) and summarize it with AI.
//   3. The resulting summary is upserted into ChatSummary (one row per
//      user).  The summarized messages are then DELETED from ChatMessage
//      so the table never grows unbounded.
//   4. chatController.sendReply() already picks up the summary and
//      prepends it to the prompt as "Previous conversation context".
// ------------------------------------------------------------------

// ---- tuneable env vars ----
// Cron expression  (default: every 30 minutes)
const CRON_EXPR = process.env.CHAT_SUMMARIZE_CRON_EXPR || "*/30 * * * *";

// Only summarize a user when they have more than this many messages total
const SUMMARIZE_THRESHOLD = Number(process.env.CHAT_SUMMARIZE_THRESHOLD ?? 30);

// Keep this many recent messages intact — never include them in the summary
const KEEP_RECENT = Number(process.env.CHAT_KEEP_RECENT ?? 20);

// ------------------------------------------------------------------

function formatChatHistory(messages) {
  return messages
    .map((chat) => {
      let line = `${chat.role}: ${chat.message}`;
      if (chat.FileAttachments && chat.FileAttachments.length > 0) {
        const names = chat.FileAttachments.map(
          (f) => f.originalName || f.name || "attachment"
        ).join(", ");
        line += ` [Files: ${names}]`;
      }
      return line;
    })
    .join("\n");
}

async function runSummarization() {
  console.log("[summarizeChats] Starting chat summarization job at", new Date().toLocaleString());

  try {
    // Get all distinct userIds that have messages
    const userRows = await db.ChatMessage.findAll({
      attributes: ["userId"],
      group: ["userId"],
      raw: true,
    });

    for (const { userId } of userRows) {
      try {
        await summarizeForUser(userId);
      } catch (err) {
        console.error(`[summarizeChats] Error processing userId=${userId}:`, err?.message || err);
      }
    }

    console.log("[summarizeChats] Job finished at", new Date().toLocaleString());
  } catch (err) {
    console.error("[summarizeChats] Fatal error in job:", err?.message || err);
  }
}

async function summarizeForUser(userId) {
  // Count total messages for this user
  const totalCount = await db.ChatMessage.count({ where: { userId } });

  if (totalCount <= SUMMARIZE_THRESHOLD) {
    // Not enough messages yet — skip
    return;
  }

  // How many messages need to be compressed?
  const toSummarizeCount = totalCount - KEEP_RECENT;
  if (toSummarizeCount <= 0) return;

  // Fetch the oldest messages that will be summarized (in ascending order)
  const oldMessages = await db.ChatMessage.findAll({
    where: { userId },
    include: [{ model: db.FileAttachment, required: false }],
    order: [["id", "ASC"]],
    limit: toSummarizeCount,
  });

  if (!oldMessages || oldMessages.length === 0) return;

  // Get the existing summary (if any) so we can build on it
  const existingSummary = await db.ChatSummary.findOne({ where: { userId } });

  // Build the text we will ask AI to summarize
  let historyText = "";
  if (existingSummary) {
    historyText += `[Previous summary up to message #${existingSummary.lastMessageId}]:\n${existingSummary.summary}\n\n[New messages to incorporate]:\n`;
  }
  historyText += formatChatHistory(oldMessages);

  // Call AI to generate the combined summary
  const newSummary = await aiService.summarizeChatHistory(historyText);
  if (!newSummary) {
    console.warn(`[summarizeChats] AI returned no summary for userId=${userId}, skipping.`);
    return;
  }

  const lastMessage = oldMessages[oldMessages.length - 1];

  // Upsert summary in DB (one row per user)
  if (existingSummary) {
    await existingSummary.update({
      summary: newSummary,
      lastMessageId: lastMessage.id,
      messageCount: (existingSummary.messageCount || 0) + oldMessages.length,
    });
  } else {
    await db.ChatSummary.create({
      userId,
      summary: newSummary,
      lastMessageId: lastMessage.id,
      messageCount: oldMessages.length,
    });
  }

  // Delete the old messages that are now baked into the summary
  const idsToDelete = oldMessages.map((m) => m.id);
  await db.ChatMessage.destroy({
    where: { id: idsToDelete },
  });

  console.log(
    `[summarizeChats] userId=${userId}: summarized ${oldMessages.length} messages, kept ${KEEP_RECENT} recent. Summary stored.`
  );
}

// Register the cron
cron.schedule(CRON_EXPR, () => {
  runSummarization();
});

console.log(`[summarizeChats] Cron registered with expression: "${CRON_EXPR}"`);
