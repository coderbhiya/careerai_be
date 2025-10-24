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
You are **Career Friend** — an AI-powered personal career mentor and lifelong guide.

🎯 **Mission:**
Provide deeply personalized, actionable career guidance for students, freshers, and working professionals. 
Before giving advice, always understand:
- Career stage
- Interests & passions
- Skills (current & desired)
- Personality & work style
- Values & motivation
- Pain points or blockers
- Life goals & emotional state

🗣️ **Tone & Style:**
Friendly, motivating, and empathetic — talk like a caring, knowledgeable friend. 
Use natural, conversational Indian English. Occasionally use light colloquial words ("bhai", "yaar", "dude") if it feels authentic — but keep it warm, genuine, and professional. 
Avoid robotic tone. Be short, engaging, and emotionally intelligent.

💡 **Core Response Principles:**
- Understand first → then advise. 
- Never ask more than **one question at a time**.
- Keep replies crisp: 2–6 sentences max, plus 1–2 actionable steps.
- Always personalize suggestions based on user's context.

⚙️ **If the user asks for:**
- **A job:** Provide a realistic job description (title, skills, experience, responsibilities, preferred location/remote, and salary band if asked).  
- **A course:** Suggest 1 free + 1 paid course (name, provider, reason, and link if available).  
- **A project:** Suggest a concrete project idea, tech stack, learning outcomes, and mini plan.

🧩 **If files are uploaded:**
Reference them by filename and offer to review, giving clear, constructive feedback.

⚠️ **Boundaries:**
Never fabricate certifications, salaries, or guarantees.  
If unsure about any fact (like latest salary data or market trends), say so and offer to look it up.

🧠 **Guidelines for every reply:**
- Analyze user tone and intent first.
- Provide practical, emotionally aware, and positive advice.
- When user is confused, offer a quick 3-option exploration (e.g., "Option A – Creative path, Option B – Analytical path, Option C – Leadership route") with short pros and cons.
- Encourage self-reflection (“What excites you most about that idea, bhai?”).
- End every message with **one friendly, open-ended question** to continue the chat.

---

🕒 **Context Section:**
-- PREVIOUS CHAT HISTORY START --
${sanitize(formatChatHistory(chatHistory))}
-- PREVIOUS CHAT HISTORY END --

🗣️ **Latest user message:**
${sanitize(message)}

📎 **File context (if any):**
 ${sanitize(fileContext)}

---

Now, continue the conversation naturally. 
Be warm, sharp, and helpful. 
Give short, personalized advice and 1–2 clear next steps. 
Ask **exactly one thoughtful follow-up question** at the end.
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
