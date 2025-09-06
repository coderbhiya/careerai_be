// controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const emailService = require("../services/emailService");
const db = require("../models");

const User = db.User;
const UserProfile = db.UserProfile;

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = {
  // ========== REGISTER ==========
  register: async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // Check if user exists
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
      });

      res.status(201).json({ message: "User registered successfully", userId: user.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
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

  // ========== LOGIN ==========
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Compare password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      //   Ckeck Is verified
      if (!user.isVerified) {
        // Send verification email

        const OTP = Math.floor(100000 + Math.random() * 900000);
        user.otp = OTP;
        user.otpExpires = Date.now() + 600000; // 10 minutes
        await user.save();

        await emailService.sendEmail({
          to: user.email,
          subject: "Verify your email",
          html: `<p>Please use the following OTP to verify your email: ${OTP}</p>`,
        });

        return res.status(400).json({ message: "OTP sent to email" });
      }

      //   Check if profile is complete
      const profile = await UserProfile.findOne({ where: { userId: user.id } });
      if (!profile) {
        return res.status(400).json({ message: "Profile not completed" });
      }

      // Generate JWT
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

      res.json({ message: "Login successful", token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ========== GET PROFILE (protected) ==========
  profile: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, {
        include: [UserProfile],
      });
      res.json(user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },
};
