const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const adminMiddleware = require("../middleware/adminAuth");

// Public routes
router.post("/login", adminController.login);
router.post("/register", adminController.register);

// Protected routes - require admin authentication
router.use(adminMiddleware);

// Profile management
router.get("/profile", adminController.getProfile);
router.put("/profile", adminController.updateProfile);
router.put("/change-password", adminController.changePassword);

// Admin management (requires super admin or admin role)
router.get("/admins", adminController.getAllAdmins);
router.put("/admins/:id/toggle-status", adminController.toggleAdminStatus);

module.exports = router;