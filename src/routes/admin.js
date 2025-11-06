const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const adminMiddleware = require("../middleware/adminAuth");
const notificationController = require("../controllers/notificationController");
const promptController = require("../controllers/promptController");
const reviewController = require("../controllers/reviewController");

// Public routes
router.post("/login", adminController.login);
router.post("/register", adminController.register);

// Protected routes - require admin authentication
router.use(adminMiddleware);

// Profile management
router.get("/profile", adminController.getProfile);
router.put("/profile", adminController.updateProfile);
router.put("/change-password", adminController.changePassword);

// Dashboard
router.get("/dashboard/stats", adminController.getDashboardStats);

// User management
router.get("/users", adminController.getUsers);
router.get("/users/:id", adminController.getUserById);
router.put("/users/:id", adminController.updateUser);
router.delete("/users/:id", adminController.deleteUser);

// Job management
router.get("/jobs", adminController.getJobs);
router.put("/jobs/:id", adminController.updateJobStatus);
router.delete("/jobs/:id", adminController.deleteJob);

// Analytics
router.get("/analytics/overview", adminController.getAnalyticsOverview);

// Settings
router.get("/settings", adminController.getSystemSettings);
router.put("/settings", adminController.updateSystemSettings);

// Reports
router.get("/reports/users", adminController.generateUserReport);

// Admin management (requires super admin or admin role)
router.get("/admins", adminController.getAllAdmins);
router.put("/admins/:id/toggle-status", adminController.toggleAdminStatus);

// Notifications management (Admin)
router.get("/notifications", notificationController.getAllNotifications);
router.post("/notifications", notificationController.createNotification);
router.delete("/notifications/:id", notificationController.deleteNotification);

// Prompt management
router.get("/prompts", promptController.listPrompts);
router.get("/prompts/active", promptController.getActivePrompt);
router.get("/prompts/:id", promptController.getPrompt);
router.post("/prompts", promptController.createPrompt);
router.put("/prompts/:id", promptController.updatePrompt);
router.delete("/prompts/:id", promptController.deletePrompt);
router.put("/prompts/:id/activate", promptController.activatePrompt);

// Reviews (admin)
router.get("/reviews", reviewController.listReviews);
router.get("/reviews/stats", reviewController.stats);
router.get("/review-questions", reviewController.listQuestionsAdmin);
router.post("/review-questions", reviewController.createQuestion);
router.put("/review-questions/:id", reviewController.updateQuestion);

module.exports = router;