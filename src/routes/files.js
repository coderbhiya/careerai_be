const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const fileController = require("../controllers/fileController");

// Upload file endpoint
router.post("/upload", authMiddleware, fileController.uploadMiddleware, fileController.uploadFile);

// Download file endpoint
router.get("/download/:filename", authMiddleware, fileController.downloadFile);

module.exports = router;
