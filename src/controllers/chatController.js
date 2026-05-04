const path = require("path");
const db = require("../models");
const aiService = require("../services/aiService");
const fs = require("fs");
const OpenAi = require("openai");
const client = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});
const OPENAI_MODEL = process.env.OPENAI_MODEL;

const chatLibrary = require("../libraries/chat/chatLibrary");
const { toolDefinitions, executeTool } = require("../libraries/chat/aiTools");

function sanitize(input) {
  if (!input) return "";
  return String(input)
    .replace(/\u0000/g, "")
    .replace(/```/g, "'``'")
    .replace(/\r/g, "")
    .trim();
}

function formatChatHistory(chatHistory = []) {
  return chatHistory
    .map((chat) => {
      let line = `${chat.role}: ${chat.message}`;
      if (chat.FileAttachments && chat.FileAttachments.length > 0) {
        const names = chat.FileAttachments.map((f) => f.originalName || f.name || "attachment").join(", ");
        line += ` [Files: ${names}]`;
      }
      return line;
    })
    .join("\n");
}

module.exports = {
  /**
   * @swagger
   * /chat:
   *   get:
   *     summary: Get user chat history
   *     tags: [Chat]
   *     responses:
   *       200:
   *         description: Chat history retrieved successfully
   *       500:
   *         description: Server error
   */
  getChats: async (req, res) => {
    try {
      const { id } = req.user;
      const chats = await db.ChatMessage.findAll({
        where: {
          userId: id,
        },
        include: [
          {
            model: db.FileAttachment,
            required: false,
          },
        ],
        order: [["id", "ASC"]],
      });

      if (chats.length === 0) {
        const firstMessage = "Hey, what's up?";

        // const emptyThread = await client.beta.threads.create();

        // const result = await db.ChatMessage.create({
        //   userId: id,
        //   role: "assistant",
        //   message: firstMessage,
        //   threadId: emptyThread.id,
        // });
        // return res.json({ success: true, chats: [result] });
      }

      res.json({ success: true, chats });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
  /**
   * @swagger
   * /chat:
   *   post:
   *     summary: Send a message to the AI
   *     tags: [Chat]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               message:
   *                 type: string
   *               fileAttachments:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     fileName:
   *                       type: string
   *                     originalName:
   *                       type: string
   *                     filePath:
   *                       type: string
   *                     fileType:
   *                       type: string
   *                     fileSize:
   *                       type: number
   *                     mimeType:
   *                       type: string
   *     responses:
   *       200:
   *         description: Message sent successfully
   *       500:
   *         description: Server error
   */
  sendReplyDeprecated: async (req, res) => {
    try {
      const { id } = req.user;
      const userId = id;
      const { message, fileAttachments } = req.body;

      const threadChat = await db.ChatMessage.findOne({
        where: {
          userId: userId,
        },
        order: [["id", "ASC"]],
      });

      let thread_id = threadChat.threadId;

      if (!threadChat) {
        const thread = await client.beta.threads.create();
        thread_id = thread.id;
        await db.ChatMessage.create({
          userId: userId,
          threadId: thread.id,
        });
      }

      // Create user message
      const userMessage = await db.ChatMessage.create(
        {
          userId: userId,
          role: "user",
          message,
          hasAttachments: fileAttachments && fileAttachments.length > 0,
        },
        // { transaction }
      );

      // Create user message
      await client.beta.threads.messages.create(thread_id, {
        role: "user",
        content: message
      });

      // Create file attachments if any
      if (fileAttachments && fileAttachments.length > 0) {
        const attachmentsData = fileAttachments.map((f) => ({
          chatMessageId: userMessage.id,
          fileName: f.fileName,
          originalName: f.originalName,
          filePath: f.filePath,
          fileType: f.fileType,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
        }));
        const attachments = await db.FileAttachment.bulkCreate(attachmentsData,
          //  { transaction }
        );

        const files = await Promise.all(fileAttachments.map(async (f) => {
          const file = await client.files.create({
            file: fs.createReadStream(path.join(process.cwd(), f.filePath)),
            purpose: "assistants",
          });
          return file;
        }));

        await Promise.all(files.map(async (file) => {
          await client.beta.threads.messages.create(thread_id, {
            role: "user",
            content: message,
            attachments: [{
              file_id: file.id,
              tools: [{
                type: "file_search"
              }]
            }],
          });
        }));
      }

      // Get Prompt
      const dbPrompt = await db.Prompt.findOne({
        where: {
          isActive: true,
        },
      });

      if (!dbPrompt) {
        return res.status(400).json({ success: false, message: "Prompt not found" });
      }

      // Run assistant on thread
      const run = await client.beta.threads.runs.create(thread_id, {
        assistant_id: dbPrompt.assistantId,
      });

      let status;
      do {
        const runStatus = await client.beta.threads.runs.retrieve(run.id, {
          thread_id: thread_id,
        });
        status = runStatus.status;
      } while (status !== "completed");

      const messages = await client.beta.threads.messages.list(thread_id);

      const lastMessage = messages.data[0].content[0].text.value;

      // Create assistant message in database
      await db.ChatMessage.create({
        userId: userId,
        role: "assistant",
        message: lastMessage,
        threadId: thread_id,
      });

      res.json({ success: true, reply: lastMessage });



    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
  sendReply: async (req, res) => {
    // const transaction = await db.sequelize.transaction();
    try {
      const { id } = req.user;
      const userId = id;
      const { message, fileAttachments } = req.body;

      // const classification = await chatLibrary.classification(message);

      // console.log("----------classification----------")
      // console.log(classification);
      // console.log('----------------------------------')

      // Get Prompt
      let classification = 'DEFAULT';
      const dbPrompt = await chatLibrary.getPromtFromClassification(classification);

      // Create user message
      const userMessage = await db.ChatMessage.create(
        {
          userId: userId,
          role: "user",
          message,
          hasAttachments: fileAttachments && fileAttachments.length > 0,
        },
        // { transaction }
      );

      // Create file attachments if any
      let savedAttachments = [];
      if (fileAttachments && fileAttachments.length > 0) {
        const attachmentsData = await Promise.all(fileAttachments.map(async (f) => {
          const summary = await aiService.summarizeFile(f.filePath, f.originalName);
          return {
            chatMessageId: userMessage.id,
            fileName: f.fileName,
            originalName: f.originalName,
            filePath: f.filePath,
            fileType: f.fileType,
            fileSize: f.fileSize,
            mimeType: f.mimeType,
            summary: summary,
          };
        }));
        savedAttachments = await db.FileAttachment.bulkCreate(attachmentsData);
      }

      // Fetch existing summary for this user (generated by cron if available)
      const chatSummary = await db.ChatSummary.findOne({ where: { userId } });

      // Fetch recent chat history (last 20 messages — older ones are baked into the summary)
      const chatHistory = await db.ChatMessage.findAll({
        where: {
          userId: userId,
        },
        include: [
          {
            model: db.FileAttachment,
            required: false,
          },
        ],
        limit: 20,
        order: [["id", "ASC"]],
      });

      // Fetch ALL file attachments from the user's entire conversation history
      const allUserFiles = await db.FileAttachment.findAll({
        include: [
          {
            model: db.ChatMessage,
            where: {
              userId: userId,
              role: "user",
            },
            required: true,
          },
        ],
        where: {
          chatMessageId: chatHistory.map((chat) => chat.id),
        },
        order: [["id", "DESC"]],
      });

      // Build comprehensive file context
      let fileContext = "";

      // Add current message files if any
      if (savedAttachments && savedAttachments.length > 0) {
        fileContext += `\n\n4. The user has uploaded the following files with their current message:\n`;
        savedAttachments.forEach((file, index) => {
          fileContext += `   - File ${index + 1}: ${file.originalName} (${file.fileType})\n`;
          if (file.summary) {
            fileContext += `     Summary: ${file.summary}\n`;
          }
        });
      }

      // Add all previously uploaded files for context
      if (allUserFiles && allUserFiles.length > 0) {
        const previousFiles = allUserFiles.filter((file) => !fileAttachments?.some((currentFile) => currentFile.fileName === file.fileName));

        if (previousFiles.length > 0) {
          fileContext += `\n\n5. Previously uploaded files in this conversation:\n`;
          previousFiles.forEach((file, index) => {
            fileContext += `   - ${file.originalName} (${file.fileType})\n`;
            if (file.summary) {
              fileContext += `     Summary: ${file.summary}\n`;
            }
          });
          fileContext += `\nNote: Please refer to these summaries when the user asks questions about these files.\n`;
        }
      }

      if (fileContext) {
        fileContext += `\nPlease acknowledge any files mentioned and offer to help analyze or review them if relevant to career guidance.\n`;
      }

      const prompt = `
${dbPrompt.content}

---
**TOOLS AVAILABLE:**
You have access to the following tools. Use them proactively when relevant:
- **save_user_profile**: Call this whenever the user mentions their current job, target role, industry, location, years of experience, or bio. Save ONLY what they explicitly mention.
- **save_user_skills**: Call this whenever the user mentions technologies, programming languages, tools, frameworks, or any skills they have. Extract ALL skills mentioned.
- **save_user_interests**: Call this whenever the user mentions career interests, field of study, degree, or educational background.
- **recommend_jobs**: Call this whenever the user asks for job recommendations, job listings, or wants to know what jobs suit them. Build keywords from their skills and target role.

You can call multiple tools in parallel if needed. After using tools, always respond naturally to the user.
---

${chatSummary ? `**Previous Conversation Summary (older messages compressed by system):**
-- SUMMARY START --
${sanitize(chatSummary.summary)}
-- SUMMARY END --

` : ""}
 **File context (if any):**
${sanitize(fileContext)}
`;

      // Build OpenAI messages array from recent chat history
      // (AI tools API uses chat.completions format, not responses format)
      const openaiMessages = chatHistory.map((chat) => ({
        role: chat.role,
        content: chat.message,
      }));

      // Add the current user message
      openaiMessages.push({ role: "user", content: sanitize(message) });

      // Call AI with function-calling support
      const { reply, toolsUsed } = await aiService.chatWithAITools(
        userId,
        prompt,          // system prompt (full context already baked in)
        openaiMessages,
        toolDefinitions,
        executeTool,
      );

      console.log(`[chatController] toolsUsed: [${toolsUsed.join(", ")}]`);

      await db.ChatMessage.create(
        {
          userId: userId,
          role: "assistant",
          message: reply,
        },
        // { transaction }
      );
      // await transaction.commit();
      res.json({ success: true, reply, toolsUsed });
    } catch (err) {
      console.error(err);
      // transaction.rollback();
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
};
