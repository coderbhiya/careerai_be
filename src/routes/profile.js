const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const authMiddleware = require("../middleware/auth");

// All routes require authentication
router.use(authMiddleware);

// Profile routes
router.get("/", profileController.getProfile);
router.put("/", profileController.updateProfile);

// Phone routes
router.post("/phone", profileController.updatePhoneNumber);

// Skills routes
router.get("/skills", profileController.getSkills);
router.post("/skills", profileController.addSkill);
router.put("/skills/:id", profileController.updateSkill);
router.delete("/skills/:id", profileController.deleteSkill);

// Experience routes
router.get("/experiences", profileController.getExperiences);
router.post("/experiences", profileController.addExperience);
router.put("/experiences/:id", profileController.updateExperience);
router.delete("/experiences/:id", profileController.deleteExperience);

module.exports = router;