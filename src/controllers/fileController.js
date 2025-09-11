const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../models");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/chat-files");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + fileExtension);
  },
});

// File filter to allow only specific file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("File type not allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

module.exports = {
  // Middleware for handling file uploads
  uploadMiddleware: upload.single("file"),

  /**
   * @swagger
   * /files/upload:
   *   post:
   *     summary: Upload a file for chat
   *     tags: [Files]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *     responses:
   *       200:
   *         description: File uploaded successfully
   *       400:
   *         description: Bad request
   *       500:
   *         description: Server error
   */
  uploadFile: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const fileData = {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: `${process.env.APP_URL}/uploads/chat-files/${req.file.filename}`,
        fileType: path.extname(req.file.originalname),
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      };

      res.json({
        success: true,
        message: "File uploaded successfully",
        file: fileData,
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ success: false, message: "Server error during file upload" });
    }
  },

  /**
   * @swagger
   * /files/download/{filename}:
   *   get:
   *     summary: Download a file
   *     tags: [Files]
   *     parameters:
   *       - in: path
   *         name: filename
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: File downloaded successfully
   *       404:
   *         description: File not found
   */
  downloadFile: async (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(__dirname, "../../uploads/chat-files", filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: "File not found" });
      }

      res.download(filePath);
    } catch (error) {
      console.error("File download error:", error);
      res.status(500).json({ success: false, message: "Server error during file download" });
    }
  },
};
