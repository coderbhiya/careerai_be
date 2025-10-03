const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const skillScoreController = require("../controllers/skillScoreController");

// All routes require authentication
router.use(authMiddleware);

router.get("/:skillId/questions", skillScoreController.getQuestions);
router.post("/:skillId/score", skillScoreController.scoreSkill);

module.exports = router;