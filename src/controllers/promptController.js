const db = require("../models");

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Admin management APIs
 * components:
 *   schemas:
 *     Prompt:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         content:
 *           type: string
 *         type:
 *           type: string
 *           enum: [chat, skill, system, other]
 *         isActive:
 *           type: boolean
 *         createdBy:
 *           type: integer
 *           nullable: true
 *         updatedBy:
 *           type: integer
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     PromptCreate:
 *       type: object
 *       required: [title, content]
 *       properties:
 *         title:
 *           type: string
 *         content:
 *           type: string
 *         type:
 *           type: string
 *           enum: [chat, skill, system, other]
 *           default: chat
 *         isActive:
 *           type: boolean
 *           default: false
 *     PromptUpdate:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *         content:
 *           type: string
 *         type:
 *           type: string
 *           enum: [chat, skill, system, other]
 *         isActive:
 *           type: boolean
 */

/**
 * Prompt management controller
 * Provides CRUD and activation utilities for prompt templates
 */
module.exports = {
  /**
   * GET /admin/prompts
   * Query params:
   *   - type (optional): filter by prompt type, e.g. "chat"
   * Response: { success: true, prompts: [...] }
   */
  listPrompts: async (req, res) => {
    /**
     * @swagger
     * /admin/prompts:
     *   get:
     *     summary: List prompts
     *     tags: [Admin]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: type
     *         schema:
     *           type: string
     *           enum: [chat, skill, system, other]
     *         description: Filter by prompt type
     *     responses:
     *       200:
     *         description: Prompts retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 prompts:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/Prompt'
     *       500:
     *         description: Server error
     */
    try {
      const { type } = req.query;
      const where = {};
      if (type) where.type = type;
      const prompts = await db.Prompt.findAll({ where, order: [["updatedAt", "DESC"]] });
      res.json({ success: true, prompts });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * GET /admin/prompts/:id
   * Path params:
   *   - id: prompt primary key
   * Response: { success: true, prompt: {...} }
   */
  getPrompt: async (req, res) => {
    /**
     * @swagger
     * /admin/prompts/{id}:
     *   get:
     *     summary: Get a prompt by ID
     *     tags: [Admin]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Prompt retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 prompt:
     *                   $ref: '#/components/schemas/Prompt'
     *       404:
     *         description: Prompt not found
     *       500:
     *         description: Server error
     */
    try {
      const { id } = req.params;
      const prompt = await db.Prompt.findByPk(id);
      if (!prompt) return res.status(404).json({ success: false, message: "Prompt not found" });
      res.json({ success: true, prompt });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * POST /admin/prompts
   * Body: { title, content, type="chat", isActive=false }
   * Rules:
   *   - title & content required
   *   - When isActive=true, all other prompts of the same type are deactivated
   * Response: 201 { success: true, prompt: {...} }
   */
  createPrompt: async (req, res) => {
    /**
     * @swagger
     * /admin/prompts:
     *   post:
     *     summary: Create a new prompt
     *     tags: [Admin]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/PromptCreate'
     *     responses:
     *       201:
     *         description: Prompt created successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 prompt:
     *                   $ref: '#/components/schemas/Prompt'
     *       400:
     *         description: Validation error
     *       500:
     *         description: Server error
     */
    try {
      const { title, content, type = "chat", isActive = false } = req.body;
      if (!title || !content) {
        return res.status(400).json({ success: false, message: "Title and content are required" });
      }
      const createdBy = req.admin?.id || null;
      // If making active, deactivate others of same type
      if (isActive) {
        await db.Prompt.update({ isActive: false }, { where: { type } });
      }
      const prompt = await db.Prompt.create({ title, content, type, isActive, createdBy });
      res.status(201).json({ success: true, prompt });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * PUT /admin/prompts/:id
   * Path params:
   *   - id: prompt primary key
   * Body: { title?, content?, type?, isActive? }
   * Rules:
   *   - When isActive=true, all other prompts of the new type are deactivated
   * Response: { success: true, prompt: {...} }
   */
  updatePrompt: async (req, res) => {
    /**
     * @swagger
     * /admin/prompts/{id}:
     *   put:
     *     summary: Update a prompt
     *     tags: [Admin]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/PromptUpdate'
     *     responses:
     *       200:
     *         description: Prompt updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 prompt:
     *                   $ref: '#/components/schemas/Prompt'
     *       404:
     *         description: Prompt not found
     *       500:
     *         description: Server error
     */
    try {
      const { id } = req.params;
      const prompt = await db.Prompt.findByPk(id);
      if (!prompt) return res.status(404).json({ success: false, message: "Prompt not found" });

      const { title, content, type, isActive } = req.body;
      const updatedBy = req.admin?.id || null;

      // If type is changed and isActive true, deactivate others of new type
      if (typeof isActive === "boolean" && isActive === true) {
        const targetType = type || prompt.type;
        await db.Prompt.update({ isActive: false }, { where: { type: targetType } });
      }

      await prompt.update({ title, content, type, isActive, updatedBy });
      res.json({ success: true, prompt });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * DELETE /admin/prompts/:id
   * Path params:
   *   - id: prompt primary key
   * Response: { success: true }
   */
  deletePrompt: async (req, res) => {
    /**
     * @swagger
     * /admin/prompts/{id}:
     *   delete:
     *     summary: Delete a prompt
     *     tags: [Admin]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Prompt deleted successfully
     *       404:
     *         description: Prompt not found
     *       500:
     *         description: Server error
     */
    try {
      const { id } = req.params;
      const prompt = await db.Prompt.findByPk(id);
      if (!prompt) return res.status(404).json({ success: false, message: "Prompt not found" });
      await prompt.destroy();
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * PUT /admin/prompts/:id/activate
   * Path params:
   *   - id: prompt primary key
   * Rules:
   *   - Deactivates all other prompts of the same type, then activates this one
   * Response: { success: true, prompt: {...} }
   */
  activatePrompt: async (req, res) => {
    /**
     * @swagger
     * /admin/prompts/{id}/activate:
     *   put:
     *     summary: Activate a prompt and deactivate others of the same type
     *     tags: [Admin]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Prompt activated successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 prompt:
     *                   $ref: '#/components/schemas/Prompt'
     *       404:
     *         description: Prompt not found
     *       500:
     *         description: Server error
     */
    try {
      const { id } = req.params;
      const prompt = await db.Prompt.findByPk(id);
      if (!prompt) return res.status(404).json({ success: false, message: "Prompt not found" });

      // Deactivate other prompts of same type
      await db.Prompt.update({ isActive: false }, { where: { type: prompt.type } });
      await prompt.update({ isActive: true, updatedBy: req.admin?.id || null });

      res.json({ success: true, prompt });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * GET /admin/prompts/active?type=chat
   * Query params:
   *   - type (optional): defaults to "chat"
   * Response: { success: true, prompt: {...} } (null if none active)
   */
  getActivePrompt: async (req, res) => {
    /**
     * @swagger
     * /admin/prompts/active:
     *   get:
     *     summary: Get the active prompt for a given type
     *     tags: [Admin]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: type
     *         schema:
     *           type: string
     *           enum: [chat, skill, system, other]
     *         description: Prompt type (defaults to chat)
     *     responses:
     *       200:
     *         description: Active prompt retrieved successfully (may be null)
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 prompt:
     *                   nullable: true
     *                   allOf:
     *                     - $ref: '#/components/schemas/Prompt'
     *       500:
     *         description: Server error
     */
    try {
      const { type = "chat" } = req.query;
      const prompt = await db.Prompt.findOne({ where: { type, isActive: true }, order: [["updatedAt", "DESC"]] });
      res.json({ success: true, prompt });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
};