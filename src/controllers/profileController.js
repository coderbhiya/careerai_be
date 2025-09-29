const db = require("../models");

const User = db.User;
const UserProfile = db.UserProfile;
const Experience = db.Experience;
const Skill = db.Skill;
const UserSkill = db.UserSkill;

module.exports = {
  /**
   * @swagger
   * /profile:
   *   get:
   *     summary: Get user profile with skills and experience
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User profile retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  getProfile: async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Get user with profile
      const user = await User.findByPk(userId, {
        include: [UserProfile],
        attributes: { exclude: ["password", "otp", "otpExpires"] }
      });

      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Get user skills
      const userSkills = await UserSkill.findAll({
        where: { userId },
        include: [Skill]
      });

      // Get user experience
      const experiences = await Experience.findAll({
        where: { userId },
        order: [["startDate", "DESC"]]
      });

      res.json({ 
        success: true, 
        user,
        skills: userSkills.map(us => ({
          id: us.id,
          skillId: us.Skill.id,
          name: us.Skill.name,
          category: us.Skill.category,
          proficiency: us.proficiency
        })),
        experiences
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /profile:
   *   put:
   *     summary: Update user profile
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               headline:
   *                 type: string
   *               bio:
   *                 type: string
   *               experienceYears:
   *                 type: integer
   *               currentRole:
   *                 type: string
   *               targetRole:
   *                 type: string
   *               targetIndustry:
   *                 type: string
   *               location:
   *                 type: string
   *               resumeUrl:
   *                 type: string
   *     responses:
   *       200:
   *         description: Profile updated successfully
   *       404:
   *         description: User or profile not found
   *       500:
   *         description: Server error
   */
  updateProfile: async (req, res) => {
    try {
      const userId = req.user.id;
      const { 
        name,
        email,
        headline, 
        bio, 
        experienceYears, 
        currentRole, 
        targetRole, 
        targetIndustry, 
        location, 
        resumeUrl 
      } = req.body;

      // Update user name if provided
      if (name) {
        await User.update({ name }, { where: { id: userId } });
      }
      // Update user email if provided
      if (email) {
        await User.update({ email }, { where: { id: userId } });
      }

      // Find or create user profile
      const [userProfile, created] = await UserProfile.findOrCreate({
        where: { userId },
        defaults: {
          userId,
          headline: headline || "",
          bio: bio || "",
          experienceYears: experienceYears || 0,
          currentRole: currentRole || "",
          targetRole: targetRole || "",
          targetIndustry: targetIndustry || "",
          location: location || "",
          resumeUrl: resumeUrl || ""
        }
      });

      // If profile exists, update it
      if (!created) {
        await userProfile.update({
          headline: headline !== undefined ? headline : userProfile.headline,
          bio: bio !== undefined ? bio : userProfile.bio,
          experienceYears: experienceYears !== undefined ? experienceYears : userProfile.experienceYears,
          currentRole: currentRole !== undefined ? currentRole : userProfile.currentRole,
          targetRole: targetRole !== undefined ? targetRole : userProfile.targetRole,
          targetIndustry: targetIndustry !== undefined ? targetIndustry : userProfile.targetIndustry,
          location: location !== undefined ? location : userProfile.location,
          resumeUrl: resumeUrl !== undefined ? resumeUrl : userProfile.resumeUrl
        });
      }

      res.json({ success: true, message: "Profile updated successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /profile/skills:
   *   get:
   *     summary: Get user skills
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User skills retrieved successfully
   *       500:
   *         description: Server error
   */
  getSkills: async (req, res) => {
    try {
      const userId = req.user.id;
      
      const userSkills = await UserSkill.findAll({
        where: { userId },
        include: [Skill]
      });

      const skills = userSkills.map(us => ({
        id: us.id,
        skillId: us.Skill.id,
        name: us.Skill.name,
        category: us.Skill.category,
        proficiency: us.proficiency
      }));

      res.json({ success: true, skills });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /profile/skills:
   *   post:
   *     summary: Add a new skill
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               category:
   *                 type: string
   *               proficiency:
   *                 type: string
   *                 enum: [beginner, intermediate, expert]
   *     responses:
   *       201:
   *         description: Skill added successfully
   *       500:
   *         description: Server error
   */
  addSkill: async (req, res) => {
    try {
      const userId = req.user.id;
      const { name, category, proficiency } = req.body;

      // Find or create the skill
      const [skill, created] = await Skill.findOrCreate({
        where: { name },
        defaults: { name, category: category || "Other" }
      });

      // Check if user already has this skill
      const existingUserSkill = await UserSkill.findOne({
        where: { userId, skillId: skill.id }
      });

      if (existingUserSkill) {
        return res.status(400).json({ 
          success: false, 
          message: "You already have this skill. Use PUT to update it." 
        });
      }

      // Add skill to user
      const userSkill = await UserSkill.create({
        userId,
        skillId: skill.id,
        proficiency: proficiency || "beginner"
      });

      res.status(201).json({ 
        success: true, 
        message: "Skill added successfully",
        skill: {
          id: userSkill.id,
          skillId: skill.id,
          name: skill.name,
          category: skill.category,
          proficiency: userSkill.proficiency
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /profile/skills/{id}:
   *   put:
   *     summary: Update a skill
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               proficiency:
   *                 type: string
   *                 enum: [beginner, intermediate, expert]
   *     responses:
   *       200:
   *         description: Skill updated successfully
   *       404:
   *         description: Skill not found
   *       500:
   *         description: Server error
   */
  updateSkill: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { proficiency } = req.body;

      const userSkill = await UserSkill.findOne({
        where: { id, userId },
        include: [Skill]
      });

      if (!userSkill) {
        return res.status(404).json({ success: false, message: "Skill not found" });
      }

      await userSkill.update({ proficiency });

      res.json({ 
        success: true, 
        message: "Skill updated successfully",
        skill: {
          id: userSkill.id,
          skillId: userSkill.Skill.id,
          name: userSkill.Skill.name,
          category: userSkill.Skill.category,
          proficiency: userSkill.proficiency
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /profile/skills/{id}:
   *   delete:
   *     summary: Delete a skill
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Skill deleted successfully
   *       404:
   *         description: Skill not found
   *       500:
   *         description: Server error
   */
  deleteSkill: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const userSkill = await UserSkill.findOne({
        where: { skillId: id, userId }
      });

      if (!userSkill) {
        return res.status(404).json({ success: false, message: "Skill not found" });
      }

      await userSkill.destroy();

      res.json({ success: true, message: "Skill deleted successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /profile/experiences:
   *   get:
   *     summary: Get user experiences
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User experiences retrieved successfully
   *       500:
   *         description: Server error
   */
  getExperiences: async (req, res) => {
    try {
      const userId = req.user.id;
      
      const experiences = await Experience.findAll({
        where: { userId },
        order: [["startDate", "DESC"]]
      });

      res.json({ success: true, experiences });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /profile/experiences:
   *   post:
   *     summary: Add a new experience
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               companyName:
   *                 type: string
   *               role:
   *                 type: string
   *               startDate:
   *                 type: string
   *                 format: date
   *               endDate:
   *                 type: string
   *                 format: date
   *               description:
   *                 type: string
   *               achievements:
   *                 type: string
   *     responses:
   *       201:
   *         description: Experience added successfully
   *       500:
   *         description: Server error
   */
  addExperience: async (req, res) => {
    try {
      const userId = req.user.id;
      const { companyName, role, startDate, endDate, description, achievements } = req.body;

      const experience = await Experience.create({
        userId,
        companyName,
        role,
        startDate,
        endDate,
        description,
        achievements
      });

      res.status(201).json({ 
        success: true, 
        message: "Experience added successfully",
        experience
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /profile/experiences/{id}:
   *   put:
   *     summary: Update an experience
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               companyName:
   *                 type: string
   *               role:
   *                 type: string
   *               startDate:
   *                 type: string
   *                 format: date
   *               endDate:
   *                 type: string
   *                 format: date
   *               description:
   *                 type: string
   *               achievements:
   *                 type: string
   *     responses:
   *       200:
   *         description: Experience updated successfully
   *       404:
   *         description: Experience not found
   *       500:
   *         description: Server error
   */
  updateExperience: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { companyName, role, startDate, endDate, description, achievements } = req.body;

      const experience = await Experience.findOne({
        where: { id, userId }
      });

      if (!experience) {
        return res.status(404).json({ success: false, message: "Experience not found" });
      }

      await experience.update({
        companyName: companyName !== undefined ? companyName : experience.companyName,
        role: role !== undefined ? role : experience.role,
        startDate: startDate !== undefined ? startDate : experience.startDate,
        endDate: endDate !== undefined ? endDate : experience.endDate,
        description: description !== undefined ? description : experience.description,
        achievements: achievements !== undefined ? achievements : experience.achievements
      });

      res.json({ 
        success: true, 
        message: "Experience updated successfully",
        experience
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /profile/experiences/{id}:
   *   delete:
   *     summary: Delete an experience
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Experience deleted successfully
   *       404:
   *         description: Experience not found
   *       500:
   *         description: Server error
   */
  deleteExperience: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const experience = await Experience.findOne({
        where: { id, userId }
      });

      if (!experience) {
        return res.status(404).json({ success: false, message: "Experience not found" });
      }

      await experience.destroy();

      res.json({ success: true, message: "Experience deleted successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};