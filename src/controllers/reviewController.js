const db = require("../models");
const { Op } = require("sequelize");

const LIKERT_CHOICES = ["very_satisfied", "satisfied", "neutral", "unsatisfied", "very_unsatisfied"];

module.exports = {
  // User: Get active review questions
  getQuestions: async (req, res) => {
    try {
      const questions = await db.ReviewQuestion.findAll({
        where: { isActive: true },
        order: [
          ["displayOrder", "ASC"],
          ["id", "ASC"],
        ],
      });
      res.json({ success: true, questions });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  // User: Submit review answers (and optional free-text comment)
  submitReview: async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
      const userId = req.user.id;
      const { answers, comment } = req.body;

      if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({ success: false, message: "Answers are required" });
      }

      const questionIds = answers.map((a) => a.questionId);
      const validQuestions = await db.ReviewQuestion.findAll({ where: { id: { [Op.in]: questionIds }, isActive: true } });
      if (validQuestions.length !== questionIds.length) {
        return res.status(400).json({ success: false, message: "Invalid or inactive questions provided" });
      }

      // Build map for validation
      const qMap = new Map(validQuestions.map((q) => [q.id, q]));

      // Validate answers according to question type
      for (const a of answers) {
        const q = qMap.get(a.questionId);
        if (!q) {
          return res.status(400).json({ success: false, message: `Question ${a.questionId} not found` });
        }

        console.log(JSON.stringify(q.options));

        const type = q.type;
        const allowMultiple = !!q.allowMultiple;
        const options = JSON.parse(JSON.stringify(q.options)) || [];

        const hasValue = a.value !== undefined && a.value !== null;
        const hasValues = Array.isArray(a.values) && a.values.length > 0;

        const ensureAllowed = (val) => options.includes(val);
        const ensureLikert = (val) => LIKERT_CHOICES.includes(val);
        const ensureString = (val) => typeof val === "string" && val.trim().length > 0;
        const ensureNumber = (val) => typeof val === "number" && !Number.isNaN(val);
        const inRange = (val) => {
          const min = q.minValue ?? 1;
          const max = q.maxValue ?? 5;
          return ensureNumber(val) && val >= min && val <= max;
        };

        if (type === "likert") {
          if (allowMultiple) {
            if (!hasValues || !a.values.every(ensureLikert)) {
              return res.status(400).json({ success: false, message: `Invalid likert values for question ${q.id}` });
            }
          } else {
            if (!hasValue || !ensureLikert(a.value)) {
              return res.status(400).json({ success: false, message: `Invalid likert value for question ${q.id}` });
            }
          }
        } else if (type === "single_choice" || type === "multi_choice") {
          if (options.length === 0) {
            return res.status(400).json({ success: false, message: `Question ${q.id} has no options` });
          }
          if (allowMultiple || type === "multi_choice") {
            if (!hasValues || !a.values.every(ensureAllowed)) {
              return res.status(400).json({ success: false, message: `Invalid choice values for question ${q.id}` });
            }
          } else {
            if (!hasValue || !ensureAllowed(a.value)) {
              return res.status(400).json({ success: false, message: `Invalid choice value for question ${q.id}` });
            }
          }
        } else if (type === "text") {
          if (allowMultiple) {
            if (!hasValues || !a.values.every(ensureString)) {
              return res.status(400).json({ success: false, message: `Invalid text values for question ${q.id}` });
            }
          } else {
            if (!hasValue || !ensureString(a.value)) {
              return res.status(400).json({ success: false, message: `Invalid text value for question ${q.id}` });
            }
          }
        } else if (type === "rating") {
          if (allowMultiple) {
            if (!hasValues || !a.values.every(inRange)) {
              return res.status(400).json({ success: false, message: `Invalid rating values for question ${q.id}` });
            }
          } else {
            if (!hasValue || !inRange(a.value)) {
              return res.status(400).json({ success: false, message: `Invalid rating value for question ${q.id}` });
            }
          }
        } else {
          return res.status(400).json({ success: false, message: `Unsupported question type for ${q.id}` });
        }
      }

      // Create review header
      const review = await db.Review.create({ userId, comment: comment || null }, { transaction });

      // Create answers
      const payload = answers.map((a) => {
        const q = qMap.get(a.questionId);
        const ans = { type: q.type };
        if (a.value !== undefined) ans.value = a.value;
        if (Array.isArray(a.values)) ans.values = a.values;
        return { reviewId: review.id, questionId: a.questionId, answer: ans };
      });
      await db.ReviewAnswer.bulkCreate(payload, { transaction });

      await transaction.commit();
      res.json({ success: true, reviewId: review.id });
    } catch (err) {
      console.error(err);
      await transaction.rollback();
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  // Admin: list all reviews with answers and user
  listReviews: async (req, res) => {
    try {
      const { page = 1, limit = 20, userId } = req.query;
      const where = {};
      if (userId) where.userId = userId;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const { count, rows } = await db.Review.findAndCountAll({
        where,
        include: [
          { model: db.User, attributes: ["id", "name", "email"] },
          { model: db.ReviewAnswer, include: [{ model: db.ReviewQuestion }] },
        ],
        order: [["createdAt", "DESC"]],
        limit: parseInt(limit),
        offset,
      });

      res.json({ success: true, reviews: rows, pagination: { total: count, page: parseInt(page), limit: parseInt(limit) } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  // Admin: stats per question (counts by choice)
  stats: async (req, res) => {
    try {
      const questions = await db.ReviewQuestion.findAll({
        order: [
          ["displayOrder", "ASC"],
          ["id", "ASC"],
        ],
      });
      const stats = [];
      for (const q of questions) {
        const qAnswers = await db.ReviewAnswer.findAll({ where: { questionId: q.id } });
        const item = { questionId: q.id, text: q.text, type: q.type };

        if (q.type === "likert") {
          const distribution = {};
          for (const c of LIKERT_CHOICES) distribution[c] = 0;
          for (const a of qAnswers) {
            const ans = a.answer || {};
            if (Array.isArray(ans.values)) {
              for (const v of ans.values) if (LIKERT_CHOICES.includes(v)) distribution[v]++;
            } else if (ans.value && LIKERT_CHOICES.includes(ans.value)) {
              distribution[ans.value]++;
            }
          }
          item.distribution = distribution;
        } else if (q.type === "single_choice" || q.type === "multi_choice") {
          const options = Array.isArray(q.options) ? q.options : [];
          const distribution = {};
          for (const opt of options) distribution[opt] = 0;
          for (const a of qAnswers) {
            const ans = a.answer || {};
            if (Array.isArray(ans.values)) {
              for (const v of ans.values) if (options.includes(v)) distribution[v]++;
            } else if (ans.value && options.includes(ans.value)) {
              distribution[ans.value]++;
            }
          }
          item.distribution = distribution;
        } else if (q.type === "rating") {
          let sum = 0;
          let count = 0;
          for (const a of qAnswers) {
            const ans = a.answer || {};
            if (Array.isArray(ans.values)) {
              for (const v of ans.values)
                if (typeof v === "number") {
                  sum += v;
                  count++;
                }
            } else if (typeof ans.value === "number") {
              sum += ans.value;
              count++;
            }
          }
          item.average = count > 0 ? sum / count : null;
          item.count = count;
        } else if (q.type === "text") {
          let count = 0;
          for (const a of qAnswers) {
            const ans = a.answer || {};
            if (Array.isArray(ans.values)) {
              count += ans.values.filter((v) => typeof v === "string" && v.trim().length > 0).length;
            } else if (typeof ans.value === "string" && ans.value.trim().length > 0) {
              count++;
            }
          }
          item.count = count;
        }
        stats.push(item);
      }
      res.json({ success: true, stats });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  // Admin: question management
  createQuestion: async (req, res) => {
    try {
      const { text, isActive = true, displayOrder = 0, type = "likert", allowMultiple = false, options = [], minValue = 1, maxValue = 5 } = req.body;
      if (!text || !text.trim()) return res.status(400).json({ success: false, message: "Question text is required" });
      const validTypes = ["likert", "single_choice", "multi_choice", "text", "rating"];
      if (!validTypes.includes(type)) return res.status(400).json({ success: false, message: "Invalid question type" });
      let opts = null;
      if (type === "single_choice" || type === "multi_choice") {
        if (!Array.isArray(options) || options.length === 0) return res.status(400).json({ success: false, message: "Options required for choice types" });
        opts = options.map((o) => String(o));
      }
      const q = await db.ReviewQuestion.create({ text: text.trim(), isActive, displayOrder, type, allowMultiple, options: opts, minValue: type === "rating" ? minValue : null, maxValue: type === "rating" ? maxValue : null });
      res.json({ success: true, question: q });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
  updateQuestion: async (req, res) => {
    try {
      const { id } = req.params;
      const { text, isActive, displayOrder, type, allowMultiple, options, minValue, maxValue } = req.body;
      const q = await db.ReviewQuestion.findByPk(id);
      if (!q) return res.status(404).json({ success: false, message: "Question not found" });
      const update = {
        text: text !== undefined ? text : q.text,
        isActive: isActive !== undefined ? isActive : q.isActive,
        displayOrder: displayOrder !== undefined ? displayOrder : q.displayOrder,
      };
      if (type !== undefined) update.type = type;
      if (allowMultiple !== undefined) update.allowMultiple = allowMultiple;
      if (options !== undefined) update.options = options;
      if (minValue !== undefined) update.minValue = minValue;
      if (maxValue !== undefined) update.maxValue = maxValue;
      await q.update(update);
      res.json({ success: true, question: q });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
  listQuestionsAdmin: async (req, res) => {
    try {
      const questions = await db.ReviewQuestion.findAll({
        order: [
          ["displayOrder", "ASC"],
          ["id", "ASC"],
        ],
      });
      res.json({ success: true, questions });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
};

