const db = require("../models");
const { Op, json } = require("sequelize");

const Skill = db.Skill;
const UserSkill = db.UserSkill;

module.exports = {
  /**
   * @swagger
   * /jobs:
   *   get:
   *     summary: Get jobs with filtering and pagination
   *     tags: [Jobs]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Number of items per page
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term for job title or company
   *       - in: query
   *         name: location
   *         schema:
   *           type: string
   *         description: Filter by location
   *       - in: query
   *         name: employmentType
   *         schema:
   *           type: string
   *         description: Filter by employment type
   *     responses:
   *       200:
   *         description: Jobs retrieved successfully
   *       500:
   *         description: Server error
   */
  getJobs: async (req, res) => {
    try {
      const userId = req.user.id;

      // Get user skills
      const userSkills = await UserSkill.findAll({
        where: { userId },
        include: [Skill],
      });

      if (!userSkills.length) {
        return res.status(400).json({ success: false, message: "You have no skills. Please add some skills to your profile." });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 9;
      const offset = (page - 1) * limit;
      const search = req.query.search || skillNames.join(" ");
      const location = req.query.location || "";
      const employmentType = req.query.employmentType || "";

      // Build filter conditions
      const whereConditions = {};

      if (search) {
        whereConditions[Op.or] = [{ title: { [Op.like]: `%${search}%` } }, { company: { [Op.like]: `%${search}%` } }, { description: { [Op.like]: `%${search}%` } }];
      }

      if (location) {
        whereConditions[Op.or] = [{ location: { [Op.like]: `%${location}%` } }, { city: { [Op.like]: `%${location}%` } }, { state: { [Op.like]: `%${location}%` } }, { jobCountry: { [Op.like]: `%${location}%` } }];
      }

      if (employmentType) {
        whereConditions.employmentType = { [Op.like]: `%${employmentType}%` };
      }

      // Get jobs with pagination
      const { count, rows: jobs } = await db.Job.findAndCountAll({
        where: whereConditions,
        limit,
        offset,
        order: [["id", "DESC"]],
      });

      // Get unique locations and employment types for filters
      const locations = await db.Job.findAll({
        attributes: ["location", "city", "state", "jobCountry"],
        group: ["location", "city", "state", "jobCountry"],
      });

      const employmentTypes = await db.Job.findAll({
        attributes: ["employmentType"],
        group: ["employmentType"],
      });

      const uniqueLocations = [
        ...new Set(
          locations
            .map((item) => [item.location, item.city, item.state, item.jobCountry])
            .flat()
            .filter(Boolean)
        ),
      ];

      const uniqueEmploymentTypes = [...new Set(employmentTypes.map((item) => item.employmentType).filter(Boolean))];

      res.json({
        success: true,
        jobs,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
        filters: {
          locations: uniqueLocations,
          employmentTypes: uniqueEmploymentTypes,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /jobs/{id}:
   *   get:
   *     summary: Get job by ID
   *     tags: [Jobs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: Job ID
   *     responses:
   *       200:
   *         description: Job retrieved successfully
   *       404:
   *         description: Job not found
   *       500:
   *         description: Server error
   */
  getJobById: async (req, res) => {
    try {
      const { id } = req.params;
      const job = await db.Job.findByPk(id);

      if (!job) {
        return res.status(404).json({ success: false, message: "Job not found" });
      }

      res.json({ success: true, job });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
};
