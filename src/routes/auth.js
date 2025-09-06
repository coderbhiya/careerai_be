// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");

// Public
router.post("/register", authController.register);
router.post("/login", authController.login);

// Protected
router.get("/profile", authMiddleware, authController.profile);

module.exports = router;
