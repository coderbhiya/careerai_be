const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../models");
const { Op } = require("sequelize");

const Admin = db.Admin;
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
      const offset = (page - 1) * limit;

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
  }
};