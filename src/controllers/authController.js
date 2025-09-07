// controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const emailService = require("../services/emailService");
const db = require("../models");

const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(require("../config/serviceAccountKey.json")),
});

const User = db.User;
const UserProfile = db.UserProfile;

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = {
  /**
   * @swagger
   * /auth/register:
   *   post:
   *     summary: Register a new user
   *     tags: [Auth]
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
   *     responses:
   *       201:
   *         description: User registered successfully
   *       400:
   *         description: Email already registered
   *       500:
   *         description: Server error
   */
  register: async (req, res) => {
    try {
      const { name, email, password, phone } = req.body;

      // Check if user exists
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        return res.status(400).json({ success: false, message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        phone,
      });

      res.status(201).json({ success: true, message: "User registered successfully", userId: user.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  completeProfile: async (req, res) => {
    try {
      const { userId, headline, bio, experienceYears, currentRole, targetRole, targetIndustry, location, resumeUrl } = req.body;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await UserProfile.create({
        userId,
        headline,
        bio,
        experienceYears,
        currentRole,
        targetRole,
        targetIndustry,
        location,
        resumeUrl,
      });

      res.status(201).json({ message: "Profile completed successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },

  /**
   * @swagger
   * /auth/login:
   *   post:
   *     summary: Login a user
   *     tags: [Auth]
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
   *         description: User logged in successfully
   *       400:
   *         description: Invalid credentials
   *       500:
   *         description: Server error
   */
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Compare password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }

      //   Ckeck Is verified
    //   if (!user.isVerified) {
    //     // Send verification email

    //     const OTP = Math.floor(100000 + Math.random() * 900000);
    //     user.otp = OTP;
    //     user.otpExpires = Date.now() + 600000; // 10 minutes
    //     await user.save();

    //     await emailService.sendEmail({
    //       to: user.email,
    //       subject: "Verify your email",
    //       html: `<p>Please use the following OTP to verify your email: ${OTP}</p>`,
    //     });

    //     return res.status(400).json({ success: false, message: "OTP sent to email" });
    //   }

      if (!user.isMobileVerified) {
        return res.status(400).json({ success: false, message: "Mobile number not verified. Please verify mobile!!!" });
      }

      //   Check if profile is complete
      const profile = await UserProfile.findOne({ where: { userId: user.id } });
      if (!profile) {
        return res.status(400).json({ success: false, message: "Profile not completed" });
      }

      // Generate JWT
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, isVerified: user.isVerified }, JWT_SECRET, { expiresIn: "7d" });

      res.json({ success: true, message: "Login successful", token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  /**
   * @swagger
   * /auth/verify-otp:
   *   post:
   *     summary: Verify OTP for email verification
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *               otp:
   *                 type: string
   *     responses:
   *       200:
   *         description: Email verified successfully
   *       400:
   *         description: Invalid or expired OTP
   *       500:
   *         description: Server error
   */

  verifyOtp: async (req, res) => {
    try {
      const { email, otp } = req.body;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Check if OTP is valid and not expired
      if (user.otp !== otp || Date.now() > user.otpExpires) {
        return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
      }

      // Update user verification status
      user.isVerified = true;
      user.otp = null;
      user.otpExpires = null;
      await user.save();

      // Generate JWT
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, isVerified: true }, JWT_SECRET, { expiresIn: "7d" });

      res.json({ success: true, message: "Email verified successfully", token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  verifyToken: async (req, res, next) => {
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      console.log("User ID:", decoded.uid);

      //   GET USER
      const user = await User.findOne({ where: { firebaseUid: decoded.uid } });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
    } catch (err) {
      console.error(err);
      res.status(401).json({ success: false, message: "Invalid token" });
    }
  },

  /**
   * @swagger
   * /profile:
   *   get:
   *     summary: Get user profile
   *     tags: [User]
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
  profile: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, {
        include: [UserProfile],
      });
      res.json({ success: true, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
};
