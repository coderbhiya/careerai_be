const db = require("../models");
const aiService = require("../services/aiService");

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
        const firstMessage = await aiService.chatWithAI(`
        You are CareerAI, a friendly career coach and mentor. 
        Your tone should be like a supportive friend (use casual words like "bro", "bhai", "yaar" sometimes). 

        Start the conversation in a light and friendly way: "Hey bro, what's up?".

        Your task:
        1. First, ask casual questions to know about the user (name, mood, interests).
        2. Then step by step ask about:
        - Their current situation (college/job)
        - Their job (if working)
        - Their company (if working)
        - Their experience (years, projects, background)
        - Their skills (technical + soft)
        - Their goals (short term + long term)
        - Their preferences (location, work-life, industry, salary expectations)
        3. If the user is confused about their career, guide them step by step to discover what they actually like.
        4. If the user already knows their direction, suggest career growth strategies, skills to learn, and trending opportunities in the market.
        5. Always be positive, supportive, and motivating.
        6. Keep the tone natural, like a caring friend, not like a strict teacher.

        ask One question at a time.
        `);
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
    const transaction = await db.sequelize.transaction();
    try {
      const { id } = req.user;
      const userId = id;
      const { message, fileAttachments } = req.body;

      // Create user message
      const userMessage = await db.ChatMessage.create(
        {
          userId: userId,
          role: "user",
          message,
          hasAttachments: fileAttachments && fileAttachments.length > 0,
        },
        { transaction }
      );

      // Create file attachments if any
      if (fileAttachments && fileAttachments.length > 0) {
        for (const attachment of fileAttachments) {
          await db.FileAttachment.create(
            {
              chatMessageId: userMessage.id,
              fileName: attachment.fileName,
              originalName: attachment.originalName,
              filePath: attachment.filePath,
              fileType: attachment.fileType,
              fileSize: attachment.fileSize,
              mimeType: attachment.mimeType,
            },
            { transaction }
          );
        }
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
      You are CareerAI, a friendly career coach and mentor. 
        Your tone should always be like a supportive friend (use casual words like "bro", "bhai", "yaar", "dude" sometimes). 

        Your task:
        1. Continue the conversation from where it left off.
        2. This is the old chat between you and the user:
        ${chatHistory
          .map((chat) => {
            let chatText = `${chat.role}: ${chat.message}`;
            if (chat.FileAttachments && chat.FileAttachments.length > 0) {
              chatText += ` [Files: ${chat.FileAttachments.map((f) => f.originalName).join(", ")}]`;
            }
            return chatText;
          })
          .join("\n")}
        3. This is the latest message from the user:
        ${message}${fileContext}

        Guidelines:
        - Understand the user's confusion, interests, skills, goals, and preferences.
        - If the user is confused (like many college students who follow random advice without clarity), help them explore their real interest.
        - If the user has clarity, guide them on skill enhancement, market needs, and relevant courses.
        - Suggest the right jobs that match their skills, JD, and preferences.
        - Be supportive and motivating. Talk like a friend who genuinely cares.
        - Keep replies short, natural, and engaging — not like a lecture.
        - If the user asks for a job, provide a detailed JD with required skills, experience, and preferences.
        - If the user asks for a course, recommend a relevant course with a link.
        - If the user asks for a project, suggest a project idea with a link.
        - IMPORTANT: When the user asks about previously uploaded documents/files, reference them by name and provide relevant guidance based on those files.
        - If files are uploaded (current or previous), acknowledge them and offer to help review/analyze them for career guidance.
        - For resumes, offer feedback on format, content, and suggestions for improvement.
        - For portfolios or project files, provide constructive feedback and career relevance.
        - Remember all files uploaded in this conversation and reference them when the user asks follow-up questions.

        ask One question at a time.
      `;

      const reply = await aiService.chatWithAI(prompt);
      await db.ChatMessage.create(
        {
          userId: userId,
          role: "assistant",
          message: reply,
        },
        { transaction }
      );
      await transaction.commit();
      res.json({ success: true, reply });
    } catch (err) {
      console.error(err);
      transaction.rollback();
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
};
