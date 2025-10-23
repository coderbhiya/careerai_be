const path = require("path");
const db = require("../models");
const aiService = require("../services/aiService");
const fs = require("fs");

function sanitize(input) {
  if (!input) return "";
  return String(input)
    .replace(/\u0000/g, '')
    .replace(/```/g, "'``'")
    .replace(/\r/g, '')
    .trim();
}

function formatChatHistory(chatHistory = []) {
  return chatHistory
    .map((chat) => {
      let line = `${chat.role}: ${chat.message}`;
      if (chat.FileAttachments && chat.FileAttachments.length > 0) {
        const names = chat.FileAttachments.map((f) => f.originalName || f.name || 'attachment').join(', ');
        line += ` [Files: ${names}]`;
      }
      return line;
    })
    .join('\n');
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
        const attachmentsData = fileAttachments.map((f) => ({
          chatMessageId: userMessage.id,
          fileName: f.fileName,
          originalName: f.originalName,
          filePath: f.filePath,
          fileType: f.fileType,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
        }));
        await db.FileAttachment.bulkCreate(attachmentsData, { transaction });
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
      You are Career Friend — an AI-powered personal career assistant and mentor. \n\nGoal: Provide hyper-personalized, actionable career guidance for students, freshers, and working professionals. Always understand before advising: career stage, interests, skills, personality, values & motivation, pain points, life goals, and emotional state.\n\nTone & Style: Friendly, motivating, supportive — talk like a trusted mentor or a caring friend. It's okay to use casual Indian colloquialisms sometimes (e.g., "bhai", "yaar", "dude", "bro") — but keep it warm and respectful. Keep replies concise, engaging, and ask only one question at a time.\n\nAction requirements: Always end with 1-2 clear, actionable next steps the user can take right now. If files were uploaded, reference them by filename and offer to review. If the user asks for: \n  - a job → provide a full JD (skills, experience, responsibilities, preferred locations/remote, salary band if asked).\n  - a course → recommend a concrete course (name + provider + short rationale + link).\n  - a project → propose a project idea, tech stack, learning outcomes, and a quick implementation plan.\n\nSafety & scope: Don't fabricate certifications or guarantees. If unsure about dates/market facts, say so and offer to look them up.\n

        -- PREVIOUS CHAT HISTORY START --\n${sanitize(formatChatHistory(chatHistory))}\n-- PREVIOUS CHAT HISTORY END --\n\nLatest user message:\n${sanitize(message)}\n\nFile context (if any):\n${sanitize(fileContext)}\n\nGuidelines (use these in every response):\n- Understand the user's situation first: ask clarifying q only when necessary, but never more than one question at a time.\n- Provide short, friendly, motivating replies (2-6 sentences), then 1-2 actionable steps.\n- When giving JDs, include: title, seniority, required skills, preferred skills, responsibilities, experience, education (if relevant), soft skills, interview tips, and sample salary band (if user asks).\n- When reviewing resumes/portfolios (files mentioned in chat), reference file names exactly and give clear format/content suggestions.\n- When suggesting courses/projects, include at least one free and one paid option if available. Provide links if asked.\n- If user appears confused, offer a 3-option quick exploration ("Try A / Try B / Try C") with short pros/cons.\n- Use casual friend-language occasionally ("bhai/yaar/dude") but not in every sentence — keep it natural.\n- Ask one question at the end to continue the conversation.\n

        Now continue the conversation from where it left off. Use the history and latest message above. Keep reply short, friendly, and actionable. Ask exactly one follow-up question (if needed).
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
