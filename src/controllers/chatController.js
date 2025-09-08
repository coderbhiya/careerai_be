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
        You are a career coach.
        First Start Conversation Like Hey Bro WhatsUp.
        First you ask question about user. 
        Then you ask question about job.
        Then you ask question about company.
        Then you ask question about user experience.
        Then you ask question about user skills.
        Then you ask question about user goals.
        Then you ask question about user preferences.
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
      You are a career coach.
      Your first task is to know about the user.
      Then you suggest to user about his career.

      This is Old Chat between You and user
      ${chatHistory.map((chat) => `${chat.role}: ${chat.message}`).join("\n")}

      This is latest massage:
      ${message}

      So Reply the user maessage with friendly way like a friend.
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
