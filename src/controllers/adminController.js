const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../models");
const { Op } = require("sequelize");

const Admin = db.Admin;
const User = db.User;
const Job = db.Job;
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = {
  /**
   * @swagger
   * /admin/register:
   *   post:
   *     summary: Register a new admin
   *     tags: [Admin]
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
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *               phone:
   *                 type: string
   *               role:
   *                 type: string
   *                 enum: [super_admin, admin, moderator]
   *               department:
   *                 type: string
   *     responses:
   *       201:
   *         description: Admin registered successfully
   *       400:
   *         description: Email already registered
   *       500:
   *         description: Server error
   */
  register: async (req, res) => {
    try {
      const { name, email, password, phone, role, department } = req.body;
      const createdBy = req.admin ? req.admin.id : null;

      // Check if admin exists
      const existing = await Admin.findOne({ where: { email } });
      if (existing) {
        return res.status(400).json({ 
          success: false, 
          message: "Email already registered" 
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create admin
      const admin = await Admin.create({
        name,
        email,
        password: hashedPassword,
        phone,
        role: role || 'admin',
        department,
        createdBy
      });

      // Remove password from response
      const { password: _, ...adminData } = admin.toJSON();

      res.status(201).json({ 
        success: true, 
        message: "Admin registered successfully", 
        admin: adminData 
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/login:
   *   post:
   *     summary: Login an admin
   *     tags: [Admin]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Admin logged in successfully
   *       400:
   *         description: Invalid credentials or account inactive
   *       404:
   *         description: Admin not found
   *       500:
   *         description: Server error
   */
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find admin by email
      const admin = await Admin.findOne({ where: { email } });
      if (!admin) {
        return res.status(404).json({ 
          success: false, 
          message: "Admin not found" 
        });
      }

      // Check if admin account is active
      if (!admin.isActive) {
        return res.status(400).json({ 
          success: false, 
          message: "Account is inactive. Please contact super admin." 
        });
      }

      // Compare password
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(401).json({ 
          success: false, 
          message: "Invalid credentials" 
        });
      }

      // Update last login
      await admin.update({ lastLogin: new Date() });

      // Generate JWT
      const token = jwt.sign(
        { 
          id: admin.id, 
          email: admin.email, 
          role: admin.role,
          type: 'admin'
        }, 
        JWT_SECRET, 
        { expiresIn: "24h" }
      );

      // Remove password from response
      const { password: _, ...adminData } = admin.toJSON();

      res.json({ 
        success: true, 
        message: "Login successful", 
        token,
        admin: adminData
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/profile:
   *   get:
   *     summary: Get admin profile
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Admin profile retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Admin not found
   *       500:
   *         description: Server error
   */
  getProfile: async (req, res) => {
    try {
      const admin = await Admin.findByPk(req.admin.id, {
        attributes: { exclude: ['password'] },
        include: [
          {
            model: Admin,
            as: 'creator',
            attributes: ['id', 'name', 'email']
          }
        ]
      });

      if (!admin) {
        return res.status(404).json({ 
          success: false, 
          message: "Admin not found" 
        });
      }

      res.json({ success: true, admin });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/profile:
   *   put:
   *     summary: Update admin profile
   *     tags: [Admin]
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
   *               phone:
   *                 type: string
   *               department:
   *                 type: string
   *               profileImage:
   *                 type: string
   *     responses:
   *       200:
   *         description: Profile updated successfully
   *       404:
   *         description: Admin not found
   *       500:
   *         description: Server error
   */
  updateProfile: async (req, res) => {
    try {
      const { name, phone, department, profileImage } = req.body;
      
      const admin = await Admin.findByPk(req.admin.id);
      if (!admin) {
        return res.status(404).json({ 
          success: false, 
          message: "Admin not found" 
        });
      }

      await admin.update({
        name: name || admin.name,
        phone: phone || admin.phone,
        department: department || admin.department,
        profileImage: profileImage || admin.profileImage
      });

      // Remove password from response
      const { password: _, ...adminData } = admin.toJSON();

      res.json({ 
        success: true, 
        message: "Profile updated successfully",
        admin: adminData
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/change-password:
   *   put:
   *     summary: Change admin password
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               currentPassword:
   *                 type: string
   *               newPassword:
   *                 type: string
   *     responses:
   *       200:
   *         description: Password changed successfully
   *       400:
   *         description: Invalid current password
   *       404:
   *         description: Admin not found
   *       500:
   *         description: Server error
   */
  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      const admin = await Admin.findByPk(req.admin.id);
      if (!admin) {
        return res.status(404).json({ 
          success: false, 
          message: "Admin not found" 
        });
      }

      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, admin.password);
      if (!isMatch) {
        return res.status(400).json({ 
          success: false, 
          message: "Current password is incorrect" 
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      
      await admin.update({ password: hashedPassword });

      res.json({ 
        success: true, 
        message: "Password changed successfully" 
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/admins:
   *   get:
   *     summary: Get all admins (super admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
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
   *         name: role
   *         schema:
   *           type: string
   *         description: Filter by role
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *     responses:
   *       200:
   *         description: Admins retrieved successfully
   *       500:
   *         description: Server error
   */
  getAllAdmins: async (req, res) => {
    try {
      const { page = 1, limit = 10, role, isActive } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build where clause
      const where = {};
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const { count, rows: admins } = await Admin.findAndCountAll({
        where,
        attributes: { exclude: ['password'] },
        include: [
          {
            model: Admin,
            as: 'creator',
            attributes: ['id', 'name', 'email']
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        admins,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/admins/{id}/toggle-status:
   *   put:
   *     summary: Toggle admin active status (super admin only)
   *     tags: [Admin]
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
   *         description: Admin status updated successfully
   *       404:
   *         description: Admin not found
   *       500:
   *         description: Server error
   */
  toggleAdminStatus: async (req, res) => {
    try {
      const { id } = req.params;
      
      const admin = await Admin.findByPk(id);
      if (!admin) {
        return res.status(404).json({ 
          success: false, 
          message: "Admin not found" 
        });
      }

      // Prevent deactivating self
      if (admin.id === req.admin.id) {
        return res.status(400).json({ 
          success: false, 
          message: "Cannot deactivate your own account" 
        });
      }

      await admin.update({ isActive: !admin.isActive });

      res.json({ 
        success: true, 
        message: `Admin ${admin.isActive ? 'activated' : 'deactivated'} successfully`,
        admin: { id: admin.id, isActive: admin.isActive }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/dashboard/stats:
   *   get:
   *     summary: Get dashboard statistics
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Dashboard stats retrieved successfully
   *       500:
   *         description: Server error
   */
  getDashboardStats: async (req, res) => {
    try {
      // Get total counts
      const totalUsers = await User.count();
      const totalJobs = await Job.count();
      const totalAdmins = await Admin.count();
      
      // Get active users (users who logged in within last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activeUsers = await User.count({
        where: {
          status: 'active'
        }
      });

      // Get recent registrations (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentRegistrations = await User.count({
        where: {
          createdAt: {
            [Op.gte]: sevenDaysAgo
          }
        }
      });

      // Get job statistics
      const activeJobs = totalJobs;

      const pendingJobs = 0;

      // Get user growth data for the last 12 months
      const userGrowthData = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const count = await User.count({
          where: {
            createdAt: {
              [Op.between]: [startOfMonth, endOfMonth]
            }
          }
        });
        
        userGrowthData.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          users: count
        });
      }

      res.json({
        success: true,
        stats: {
          totalUsers,
          totalJobs,
          totalAdmins,
          activeUsers,
          recentRegistrations,
          activeJobs,
          pendingJobs,
          userGrowthData
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/users:
   *   get:
   *     summary: Get all users with pagination and filters
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
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
   *         description: Search by name or email
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: Filter by verification status
   *     responses:
   *       200:
   *         description: Users retrieved successfully
   *       500:
   *         description: Server error
   */
  getUsers: async (req, res) => {
    try {
      const { page = 1, limit = 10, search = '', status = '' } = req.query;
      const offset = (page - 1) * limit;

      // Build where clause
      const where = {};
      
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];
      }
      
      if (status) {
        where.isVerified = status === 'verified';
      }

      const { count, rows: users } = await User.findAndCountAll({
        where,
        attributes: { exclude: ['password'] },
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        users,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/users/{id}:
   *   get:
   *     summary: Get user by ID
   *     tags: [Admin]
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
   *         description: User retrieved successfully
   *       404:
   *         description: User not found
   *       500:
   *         description: Server error
   */
  getUserById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const user = await User.findByPk(id, {
        attributes: { exclude: ['password'] }
      });
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      res.json({ success: true, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/users/{id}:
   *   put:
   *     summary: Update user
   *     tags: [Admin]
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
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *               isVerified:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: User updated successfully
   *       404:
   *         description: User not found
   *       500:
   *         description: Server error
   */
  updateUser: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, isVerified } = req.body;
      
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      await user.update({ name, email, isVerified });

      // Remove password from response
      const { password: _, ...userData } = user.toJSON();

      res.json({ 
        success: true, 
        message: "User updated successfully",
        user: userData
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/users/{id}:
   *   delete:
   *     summary: Delete user
   *     tags: [Admin]
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
   *         description: User deleted successfully
   *       404:
   *         description: User not found
   *       500:
   *         description: Server error
   */
  deleteUser: async (req, res) => {
    try {
      const { id } = req.params;
      
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      await user.destroy();

      res.json({ 
        success: true, 
        message: "User deleted successfully"
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/jobs:
   *   get:
   *     summary: Get all jobs with pagination and filters
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
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
   *         description: Search by title or company
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: Filter by job status
   *     responses:
   *       200:
   *         description: Jobs retrieved successfully
   *       500:
   *         description: Server error
   */
  getJobs: async (req, res) => {
    try {
      const { page = 1, limit = 10, search = '', status = '' } = req.query;
      const offset = (page - 1) * limit;

      // Build where clause
      const where = {};
      
      if (search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { company: { [Op.like]: `%${search}%` } }
        ];
      }
      
      if (status) {
        where.status = status;
      }

      const { count, rows: jobs } = await Job.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        jobs,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/jobs/{id}:
   *   put:
   *     summary: Update job status
   *     tags: [Admin]
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
   *               status:
   *                 type: string
   *                 enum: [active, inactive, pending]
   *     responses:
   *       200:
   *         description: Job updated successfully
   *       404:
   *         description: Job not found
   *       500:
   *         description: Server error
   */
  updateJobStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const job = await Job.findByPk(id);
      if (!job) {
        return res.status(404).json({ 
          success: false, 
          message: "Job not found" 
        });
      }

      await job.update({ status });

      res.json({ 
        success: true, 
        message: "Job status updated successfully",
        job
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /admin/jobs/{id}:
   *   delete:
   *     summary: Delete job
   *     tags: [Admin]
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
   *         description: Job deleted successfully
   *       404:
   *         description: Job not found
   *       500:
   *         description: Server error
   */
  deleteJob: async (req, res) => {
    try {
      const { id } = req.params;
      
      const job = await Job.findByPk(id);
      if (!job) {
        return res.status(404).json({ 
          success: false, 
          message: "Job not found" 
        });
      }

      await job.destroy();

      res.json({ 
         success: true, 
         message: "Job deleted successfully"
       });
     } catch (err) {
       console.error(err);
       res.status(500).json({ success: false, message: "Server error" });
     }
   },

   /**
    * @swagger
    * /admin/analytics/overview:
    *   get:
    *     summary: Get analytics overview
    *     tags: [Admin]
    *     security:
    *       - bearerAuth: []
    *     responses:
    *       200:
    *         description: Analytics overview retrieved successfully
    *       500:
    *         description: Server error
    */
   getAnalyticsOverview: async (req, res) => {
     try {
       // Get user analytics for the last 30 days
       const thirtyDaysAgo = new Date();
       thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

       const userAnalytics = await User.findAll({
         attributes: [
           [db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'date'],
           [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
         ],
         where: {
           createdAt: {
             [Op.gte]: thirtyDaysAgo
           }
         },
         group: [db.sequelize.fn('DATE', db.sequelize.col('createdAt'))],
         order: [[db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'ASC']]
       });

       // Get job analytics
       const jobAnalytics = await Job.findAll({
         attributes: [
           [db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'date'],
           [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
         ],
         where: {
           createdAt: {
             [Op.gte]: thirtyDaysAgo
           }
         },
         group: [db.sequelize.fn('DATE', db.sequelize.col('createdAt'))],
         order: [[db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'ASC']]
       });

       // Get top performing metrics
       const topMetrics = {
         mostActiveUsers: await User.findAll({
           attributes: ['id', 'name', 'email', 'lastLogin'],
           where: {
             lastLogin: {
               [Op.gte]: thirtyDaysAgo
             }
           },
           order: [['lastLogin', 'DESC']],
           limit: 10
         }),
         recentJobs: await Job.findAll({
           attributes: ['id', 'title', 'company', 'status', 'createdAt'],
           order: [['createdAt', 'DESC']],
           limit: 10
         })
       };

       res.json({
         success: true,
         analytics: {
           userAnalytics,
           jobAnalytics,
           topMetrics
         }
       });
     } catch (err) {
       console.error(err);
       res.status(500).json({ success: false, message: "Server error" });
     }
   },

   /**
    * @swagger
    * /admin/settings:
    *   get:
    *     summary: Get system settings
    *     tags: [Admin]
    *     security:
    *       - bearerAuth: []
    *     responses:
    *       200:
    *         description: System settings retrieved successfully
    *       500:
    *         description: Server error
    */
   getSystemSettings: async (req, res) => {
     try {
       // Mock system settings - in a real app, these would come from a settings table
       const settings = {
         general: {
           siteName: "CareerAI",
           siteDescription: "AI-powered career guidance platform",
           maintenanceMode: false,
           registrationEnabled: true
         },
         email: {
           smtpEnabled: true,
           emailVerificationRequired: true,
           notificationsEnabled: true
         },
         security: {
           passwordMinLength: 8,
           sessionTimeout: 24, // hours
           maxLoginAttempts: 5,
           twoFactorEnabled: false
         },
         features: {
           chatEnabled: true,
           jobRecommendationsEnabled: true,
           profileAnalysisEnabled: true,
           resumeBuilderEnabled: true
         }
       };

       res.json({
         success: true,
         settings
       });
     } catch (err) {
       console.error(err);
       res.status(500).json({ success: false, message: "Server error" });
     }
   },

   /**
    * @swagger
    * /admin/settings:
    *   put:
    *     summary: Update system settings
    *     tags: [Admin]
    *     security:
    *       - bearerAuth: []
    *     requestBody:
    *       required: true
    *       content:
    *         application/json:
    *           schema:
    *             type: object
    *     responses:
    *       200:
    *         description: Settings updated successfully
    *       500:
    *         description: Server error
    */
   updateSystemSettings: async (req, res) => {
     try {
       const { settings } = req.body;
       
       // In a real application, you would save these to a database
       // For now, we'll just return success
       
       res.json({
         success: true,
         message: "Settings updated successfully",
         settings
       });
     } catch (err) {
       console.error(err);
       res.status(500).json({ success: false, message: "Server error" });
     }
   },

   /**
    * @swagger
    * /admin/reports/users:
    *   get:
    *     summary: Generate user report
    *     tags: [Admin]
    *     security:
    *       - bearerAuth: []
    *     parameters:
    *       - in: query
    *         name: startDate
    *         schema:
    *           type: string
    *           format: date
    *         description: Start date for report
    *       - in: query
    *         name: endDate
    *         schema:
    *           type: string
    *           format: date
    *         description: End date for report
    *     responses:
    *       200:
    *         description: User report generated successfully
    *       500:
    *         description: Server error
    */
   generateUserReport: async (req, res) => {
     try {
       const { startDate, endDate } = req.query;
       
       const where = {};
       if (startDate && endDate) {
         where.createdAt = {
           [Op.between]: [new Date(startDate), new Date(endDate)]
         };
       }

       const report = {
         totalUsers: await User.count({ where }),
         verifiedUsers: await User.count({ where: { ...where, isVerified: true } }),
         unverifiedUsers: await User.count({ where: { ...where, isVerified: false } }),
         usersByMonth: await User.findAll({
           attributes: [
             [db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt')), 'month'],
             [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
           ],
           where,
           group: [db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt'))],
           order: [[db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt')), 'ASC']]
         })
       };

       res.json({
         success: true,
         report
       });
     } catch (err) {
       console.error(err);
       res.status(500).json({ success: false, message: "Server error" });
     }
   }
 };