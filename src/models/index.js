const { database } = require("../config/config");

const { Sequelize, DataTypes } = require("sequelize");
const sequelize = new Sequelize(`${database.database}`, `${database.user}`, `${database.password}`, {
  host: database.host,
  dialect: "mysql",
  port: database.port,
  logging: true,
  pool: {
    max: 20,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

const db = {};

// Import models
db.User = require("./User")(sequelize, DataTypes);
db.UserProfile = require("./UserProfile")(sequelize, DataTypes);
db.Experience = require("./Experience")(sequelize, DataTypes);
db.Skill = require("./Skill")(sequelize, DataTypes);
db.UserSkill = require("./UserSkill")(sequelize, DataTypes);
db.ChatMessage = require("./ChatMessage")(sequelize, DataTypes);
db.FileAttachment = require("./FileAttachment")(sequelize, DataTypes);
db.Job = require("./Job")(sequelize, DataTypes);
db.Application = require("./Application")(sequelize, DataTypes);
db.ResumeVersion = require("./ResumeVersion")(sequelize, DataTypes);
db.ApplicationFeedback = require("./ApplicationFeedback")(sequelize, DataTypes);
db.Certification = require("./Certification")(sequelize, DataTypes);
db.Notification = require("./Notification")(sequelize, DataTypes);
db.Prompt = require("./Prompt")(sequelize, DataTypes);
db.Review = require("./Review")(sequelize, DataTypes);
db.ReviewQuestion = require("./ReviewQuestion")(sequelize, DataTypes);
db.ReviewAnswer = require("./ReviewAnswer")(sequelize, DataTypes);

// Admin
db.Admin = require("./Admin")(sequelize, DataTypes);

// ======================
// Define Associations
// ======================

// User ↔ UserProfile (1:1)
db.User.hasOne(db.UserProfile, { foreignKey: "userId" });
db.UserProfile.belongsTo(db.User, { foreignKey: "userId" });

// User ↔ Experience (1:M)
db.User.hasMany(db.Experience, { foreignKey: "userId" });
db.Experience.belongsTo(db.User, { foreignKey: "userId" });

// User ↔ Skill (M:M through UserSkill)
db.User.belongsToMany(db.Skill, { through: db.UserSkill, foreignKey: "userId" });
db.Skill.belongsToMany(db.User, { through: db.UserSkill, foreignKey: "skillId" });

// Skill ↔ UserSkill (1:M)
db.Skill.hasMany(db.UserSkill, { foreignKey: "skillId" });
db.UserSkill.belongsTo(db.Skill, { foreignKey: "skillId" });

// User ↔ Application (1:M)
db.User.hasMany(db.Application, { foreignKey: "userId" });
db.Application.belongsTo(db.User, { foreignKey: "userId" });

// Job ↔ Application (1:M)
db.Job.hasMany(db.Application, { foreignKey: "jobId" });
db.Application.belongsTo(db.Job, { foreignKey: "jobId" });

// Application ↔ ResumeVersion (1:1)
db.Application.belongsTo(db.ResumeVersion, { foreignKey: "resumeVersionId" });
db.ResumeVersion.hasMany(db.Application, { foreignKey: "resumeVersionId" });

// Application ↔ ApplicationFeedback (1:M)
db.Application.hasMany(db.ApplicationFeedback, { foreignKey: "applicationId" });
db.ApplicationFeedback.belongsTo(db.Application, { foreignKey: "applicationId" });

// User ↔ Certification (1:M)
db.User.hasMany(db.Certification, { foreignKey: "userId" });
db.Certification.belongsTo(db.User, { foreignKey: "userId" });

// User ↔ Notification (1:M)
db.User.hasMany(db.Notification, { foreignKey: "userId" });
db.Notification.belongsTo(db.User, { foreignKey: "userId" });

// User ↔ ChatMessage (1:M)
db.User.hasMany(db.ChatMessage, { foreignKey: "userId" });
db.ChatMessage.belongsTo(db.User, { foreignKey: "userId" });

// ChatMessage ↔ FileAttachment (1:M)
db.ChatMessage.hasMany(db.FileAttachment, { foreignKey: "chatMessageId" });
db.FileAttachment.belongsTo(db.ChatMessage, { foreignKey: "chatMessageId" });

// User ↔ Review (1:M)
db.User.hasMany(db.Review, { foreignKey: "userId" });
db.Review.belongsTo(db.User, { foreignKey: "userId" });

// Review ↔ ReviewAnswer (1:M)
db.Review.hasMany(db.ReviewAnswer, { foreignKey: "reviewId" });
db.ReviewAnswer.belongsTo(db.Review, { foreignKey: "reviewId" });

// ReviewQuestion ↔ ReviewAnswer (1:M)
db.ReviewQuestion.hasMany(db.ReviewAnswer, { foreignKey: "questionId" });
db.ReviewAnswer.belongsTo(db.ReviewQuestion, { foreignKey: "questionId" });


// Admin <-> Admin (1:M)
db.Admin.hasMany(db.Admin, { foreignKey: "createdBy", as: "createdAdmins" });
db.Admin.belongsTo(db.Admin, { foreignKey: "createdBy", as: "creator" });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
