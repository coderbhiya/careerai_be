const express = require("express");
const router = express.Router();
const jobController = require("../controllers/jobController");const authMiddleware = require("../middleware/auth");

// All routes require authentication
router.use(authMiddleware);

router.get("/", jobController.getJobs);
router.get("/:id", jobController.getJobById);

module.exports = router;