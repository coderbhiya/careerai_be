const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const reviewController = require("../controllers/reviewController");

// All routes require authentication
router.use(authMiddleware);

// User endpoints
router.get("/questions", reviewController.getQuestions);
router.post("/", reviewController.submitReview);

module.exports = router;