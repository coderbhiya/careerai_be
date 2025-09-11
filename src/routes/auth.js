const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");

// Public
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/verify-otp", authController.verifyOtp);
router.post("/verify-token", authController.verifyToken);
router.post("/google", authController.googleAuth);

// Protected
router.get("/profile", authMiddleware, authController.profile);

module.exports = router;
