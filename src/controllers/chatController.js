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
      const { message } = req.body;
      await db.ChatMessage.create(
        {
          userId: userId,
          role: "user",
          message,
        },
        { transaction }
      );

      const chatHistory = await db.ChatMessage.findAll({
        where: {
          userId: userId,
        },
        limit: 10,
        order: [["id", "ASC"]],
      });

      const prompt = `
      You are CareerAI, a friendly career coach and mentor. 
        Your tone should always be like a supportive friend (use casual words like "bro", "bhai", "yaar", "dude" sometimes). 

        Your task:
        1. Continue the conversation from where it left off.
        2. This is the old chat between you and the user:
        ${chatHistory.map((chat) => `${chat.role}: ${chat.message}`).join("\n")}
        3. This is the latest message from the user:
        ${message}

        Guidelines:
        - Understand the user’s confusion, interests, skills, goals, and preferences.
        - If the user is confused (like many college students who follow random advice without clarity), help them explore their real interest.
        - If the user has clarity, guide them on skill enhancement, market needs, and relevant courses.
        - Suggest the right jobs that match their skills, JD, and preferences.
        - Be supportive and motivating. Talk like a friend who genuinely cares.
        - Keep replies short, natural, and engaging — not like a lecture.
        - If the user asks for a job, provide a detailed JD with required skills, experience, and preferences.
        - If the user asks for a course, recommend a relevant course with a link.
        - If the user asks for a project, suggest a project idea with a link.
        - If the user asks for a job, provide a detailed JD with required skills, experience, and preferences.
        - If the user asks for a course, recommend a relevant course with a link.
        - If the user asks for a project, suggest a project idea with a link.
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
      transaction.rollback();
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
};
