const path = require("path");
const db = require("../models");
const aiService = require("../services/aiService");
const fs = require("fs");

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
        const firstMessage = "Hey bro, what's up?";
        const result = await db.ChatMessage.create({
          userId: id,
          role: "assistant",
          message: firstMessage,
        });
        return res.json({ success: true, chats: [result] });
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
  sendReply: async (req, res) => {
    // const transaction = await db.sequelize.transaction();
    try {
      const { id } = req.user;
      const userId = id;
      const { message, fileAttachments } = req.body;

      // Get Prompt
      const dbPrompt = await db.Prompt.findOne({
        where: {
          isActive: true,
        },
      });

      if (!dbPrompt) {
        return res.status(400).json({ success: false, message: "Prompt not found" });
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
        await db.FileAttachment.bulkCreate(attachmentsData,
          //  { transaction }
          );
      }

      // Fetch recent chat history (increased limit for better context)
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
      if (fileAttachments && fileAttachments.length > 0) {
        fileContext += `\n\n4. The user has uploaded the following files with their current message:\n`;
        fileAttachments.forEach((file, index) => {
          fileContext += `   - File ${index + 1}: ${file.originalName} (${file.fileType}, ${(file.fileSize / 1024).toFixed(2)} KB)\n`;
        });
      }

      // Add all previously uploaded files for context
      if (allUserFiles && allUserFiles.length > 0) {
        const previousFiles = allUserFiles.filter((file) => !fileAttachments?.some((currentFile) => currentFile.fileName === file.fileName));

        if (previousFiles.length > 0) {
          fileContext += `\n\n5. Previously uploaded files in this conversation that you can reference:\n`;
          previousFiles.forEach((file, index) => {
            fileContext += `   - ${file.originalName} (${file.fileType}, uploaded earlier)\n`;
          });
          fileContext += `\nNote: The user may ask questions about any of these previously uploaded files. Please reference them when relevant.\n`;
        }
      }

      if (fileContext) {
        fileContext += `\nPlease acknowledge any files mentioned and offer to help analyze or review them if relevant to career guidance.\n`;
      }

      const prompt = `
${dbPrompt.content}



 **Context:**
-- PREVIOUS CHAT HISTORY START --
${sanitize(formatChatHistory(chatHistory))}
-- PREVIOUS CHAT HISTORY END --

 **Latest user message:**
${sanitize(message)}

 **File context (if any):**
${sanitize(fileContext)}

---
`;

      const files = allUserFiles.map((file) => ({
        name: file.fileName,
        path: file.filePath.replace(`${process.env.APP_URL}/`, ""),
      }));

      const reply = await aiService.chatWithAI(prompt, files);
      await db.ChatMessage.create(
        {
          userId: userId,
          role: "assistant",
          message: reply,
        },
        // { transaction }
      );
      // await transaction.commit();
      res.json({ success: true, reply });
    } catch (err) {
      console.error(err);
      // transaction.rollback();
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
};
