const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");

const chatController = require("../controllers/chatController");

router.post("/", authMiddleware, chatController.sendReply);
router.get("/", authMiddleware, chatController.getChats);

module.exports = router;