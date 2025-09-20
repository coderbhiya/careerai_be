const jwt = require("jsonwebtoken");
const db = require("../models");
const Admin = db.Admin;

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Admin authentication middleware
 * Verifies JWT token and ensures the user is an admin
 */
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false, 
        message: "No token provided" 
      });
    }

    const token = authHeader.split(" ")[1];
    
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if token is for admin
    if (decoded.type !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin privileges required." 
      });
    }

    // Fetch admin from database to ensure account is still active
    const admin = await Admin.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });

    if (!admin) {
      return res.status(401).json({ 
        success: false, 
        message: "Admin account not found" 
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: "Admin account is inactive" 
      });
    }

    // Attach admin info to request
    req.admin = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      name: admin.name,
      department: admin.department
    };

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid token" 
      });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: "Token expired" 
      });
    }
    
    console.error('Admin auth middleware error:', err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error during authentication" 
    });
  }
};

/**
 * Role-based authorization middleware
 * Checks if admin has required role
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
      });
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 * Checks if admin has required permission for a resource
 */
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    const permissions = req.admin.permissions;
    
    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      return next();
    }

    // Check if admin has permission for the resource and action
    if (!permissions[resource] || !permissions[resource][action]) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required permission: ${resource}.${action}` 
      });
    }

    next();
  };
};

module.exports = adminAuth;
module.exports.requireRole = requireRole;
module.exports.requirePermission = requirePermission;