const { database } = require("../config/config");

const { Sequelize, DataTypes } = require("sequelize");
const sequelize = new Sequelize({
  dialect: "mysql",
  host: database.host,
  port: database.port,
  database: database.database,
  username: database.user,
  password: database.password,
  logging: true,
});

const db = {};

// Import models
db.User = require("./User")(sequelize, DataTypes);
db.UserProfile = require("./UserProfile")(sequelize, DataTypes);
db.Experience = require("./Experience")(sequelize, DataTypes);
db.Skill = require("./Skill")(sequelize, DataTypes);
db.UserSkill = require("./UserSkill")(sequelize, DataTypes);
db.ChatMessage = require("./ChatMessage")(sequelize, DataTypes);
db.Job = require("./Job")(sequelize, DataTypes);
db.Application = require("./Application")(sequelize, DataTypes);
db.ResumeVersion = require("./ResumeVersion")(sequelize, DataTypes);
db.ApplicationFeedback = require("./ApplicationFeedback")(sequelize, DataTypes);
db.Certification = require("./Certification")(sequelize, DataTypes);
db.Notification = require("./Notification")(sequelize, DataTypes);

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

// ChatMessage ↔ User (1:M)
db.User.hasMany(db.ChatMessage, { foreignKey: "userId" });
db.ChatMessage.belongsTo(db.User, { foreignKey: "userId" });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
