const db = require("../models");
const aiService = require("../services/aiService");

const DEFAULT_QUESTIONS = [
  "Describe your recent project using this skill. What was your role?",
  "How comfortable are you with core concepts of this skill?",
  "What frameworks/tools do you use with this skill?",
  "Share a challenging bug or issue you solved recently.",
  "How do you approach learning and staying updated in this skill?",
  "Rate your proficiency from 1 (beginner) to 10 (expert) and why.",
  "What best practices do you follow when using this skill?",
  "How do you handle performance or optimization concerns?",
  "What areas do you feel you need improvement in?",
  "Give an example where this skill impacted business outcomes.",
];

module.exports = {
  /**
   * GET /skill-score/:skillId/questions
   * Returns a list of 10 questions tailored to the skill.
   */
  getQuestions: async (req, res) => {
    try {
      const userId = req.user.id;
      const { skillId } = req.params;

      // Verify the user has this skill
      const userSkill = await db.UserSkill.findOne({
        where: { userId, skillId },
        include: [db.Skill],
      });

      if (!userSkill) {
        return res.status(404).json({ success: false, message: "Skill not found for user" });
      }

      const skillName = userSkill.Skill?.name || "the skill";

      // Ask AI to generate concise evaluation questions
      const prompt = `
You are a skill evaluator. Generate 10 concise, clear, practical questions to assess the user's proficiency in ${skillName}.
Focus on real-world usage, core concepts, problem solving, best practices, and impact.
Return questions as a plain list separated by newlines, no numbering or extra text.
      `;

      let questions = DEFAULT_QUESTIONS;
      try {
        const aiText = await aiService.chatWithAI(prompt);
        const lines = aiText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => !!l);
        if (lines.length >= 10) {
          questions = lines.slice(0, 10);
        }
      } catch (e) {
        // Fallback to defaults
        console.error("AI question generation failed, using defaults.", e);
      }

      return res.json({ success: true, skill: { id: userSkill.Skill.id, name: skillName }, questions });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * POST /skill-score/:skillId/score
   * Body: { answers: string[] }
   * Evaluates answers and updates UserSkill.skillScore.
   */
  scoreSkill: async (req, res) => {
    try {
      const userId = req.user.id;
      const { skillId } = req.params;
      const { answers } = req.body;

      if (!Array.isArray(answers) || answers.length < 10) {
        return res.status(400).json({ success: false, message: "Provide 10 answers to evaluate." });
      }

      const userSkill = await db.UserSkill.findOne({
        where: { userId, skillId },
        include: [db.Skill],
      });

      if (!userSkill) {
        return res.status(404).json({ success: false, message: "Skill not found for user" });
      }

      const skillName = userSkill.Skill?.name || "the skill";

      const prompt = `
You are a rigorous evaluator. The user answered 10 questions about ${skillName}.
Assess proficiency from 0 to 100 based on clarity, practical experience, understanding of core concepts, problem-solving, best practices, and impact.
Return a JSON object ONLY with keys: score (number 0-100) and feedback (short string with strengths and improvements).

Answers:\n${answers.map((a, i) => `${i + 1}. ${a}`).join("\n")}
      `;

      let score = 0;
      let feedback = "";
      try {
        const aiText = await aiService.chatWithAI(prompt);
        // Attempt to parse JSON from AI response
        const match = aiText.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          score = Math.max(0, Math.min(100, Number(parsed.score || 0)));
          feedback = String(parsed.feedback || "");
        } else {
          // Fallback simple heuristic: average of self-rating if present
          const selfRating = answers.map((a) => (a.match(/\b(\d{1,2})\b/) ? Number(a.match(/\b(\d{1,2})\b/)[1]) : null)).filter((n) => n !== null);
          const avg = selfRating.length ? selfRating.reduce((s, n) => s + n, 0) / selfRating.length : 5;
          score = Math.round((avg / 10) * 100);
          feedback = "Evaluation completed. Improve core concepts, tooling depth, and best practices.";
        }
      } catch (e) {
        console.error("AI scoring failed, using fallback.", e);
        score = 50;
        feedback = "Evaluation fallback. Consider strengthening fundamentals and practical problem solving.";
      }

      await userSkill.update({ skillScore: score });

      return res.json({ success: true, score, feedback });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
};
