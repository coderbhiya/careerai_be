const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const notificationController = require("../controllers/notificationController");

// All routes require user auth here
router.use(authMiddleware);

router.get("/", notificationController.getMyNotifications);
router.patch("/:id/read", notificationController.markAsRead);

module.exports = router;