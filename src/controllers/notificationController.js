const db = require("../models");

module.exports = {
  // Admin: create notification (to user or broadcast)
  /**
   * @swagger
   * /admin/notifications:
   *   post:
   *     summary: Create a notification (broadcast or targeted to a user)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               type:
   *                 type: string
   *                 enum: [job_alert, application_update, ai_tip, skill_improvement, common]
   *               title:
   *                 type: string
   *               message:
   *                 type: string
   *               link:
   *                 type: string
   *                 description: Optional URL related to the notification
   *               targetAll:
   *                 type: boolean
   *                 description: If true, broadcast to all users
   *               userId:
   *                 type: integer
   *                 description: Required when targetAll is false
   *               metadata:
   *                 type: object
   *                 additionalProperties: true
   *             required: [type, message]
   *     responses:
   *       200:
   *         description: Notification created successfully
   *       400:
   *         description: Validation error (e.g., missing fields)
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  createNotification: async (req, res) => {
    try {
      const { type, title, message, link, targetAll = false, userId, metadata } = req.body;

      if (!message || !type) {
        return res.status(400).json({ success: false, message: "type and message are required" });
      }

      // If not broadcast, must have a target user
      if (!targetAll && !userId) {
        return res.status(400).json({ success: false, message: "userId required when targetAll is false" });
      }

      const payload = {
        type,
        title: title || null,
        message,
        link: link || null,
        targetAll: !!targetAll,
        isRead: false,
        metadata: metadata || null,
        userId: targetAll ? null : userId,
      };

      const notification = await db.Notification.create(payload);
      res.json({ success: true, notification });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  // Admin: list all notifications
  /**
   * @swagger
   * /admin/notifications:
   *   get:
   *     summary: Get all notifications
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Notifications retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  getAllNotifications: async (req, res) => {
    try {
      const notifications = await db.Notification.findAll({ order: [["createdAt", "DESC"]] });
      res.json({ success: true, notifications });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  // Admin: delete notification
  /**
   * @swagger
   * /admin/notifications/{id}:
   *   delete:
   *     summary: Delete a notification
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
   *         description: Notification deleted successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Notification not found
   *       500:
   *         description: Server error
   */
  deleteNotification: async (req, res) => {
    try {
      const { id } = req.params;
      const n = await db.Notification.findByPk(id);
      if (!n) return res.status(404).json({ success: false, message: "Notification not found" });
      await n.destroy();
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  // User: get my notifications (broadcast or targeted to me)
  /**
   * @swagger
   * /notifications:
   *   get:
   *     summary: Get current user's notifications (broadcast and targeted)
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Notifications retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  getMyNotifications: async (req, res) => {
    try {
      const { Op } = require("sequelize");
      const userId = req.user.id;
      const notifications = await db.Notification.findAll({
        where: { [Op.or]: [{ targetAll: true }, { userId }] },
        order: [["createdAt", "DESC"]],
      });
      res.json({ success: true, notifications });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  // User: mark a notification as read (only if targeted to me)
  /**
   * @swagger
   * /notifications/{id}/read:
   *   patch:
   *     summary: Mark a targeted notification as read
   *     tags: [Notifications]
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
   *         description: Notification marked as read
   *       400:
   *         description: Cannot mark broadcast notifications globally
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden (notification not owned by user)
   *       404:
   *         description: Notification not found
   *       500:
   *         description: Server error
   */
  markAsRead: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const n = await db.Notification.findByPk(id);
      if (!n) return res.status(404).json({ success: false, message: "Notification not found" });
      if (n.targetAll) {
        // For broadcast notifications, we won't mutate original. In real app, track per-user read state separately.
        return res.status(400).json({ success: false, message: "Cannot mark broadcast notification as read globally" });
      }
      if (n.userId !== userId) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      await n.update({ isRead: true });
      res.json({ success: true, notification: n });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
};