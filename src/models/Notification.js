module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define("Notification", {
    type: DataTypes.ENUM("job_alert", "application_update", "ai_tip"),
    message: DataTypes.TEXT,
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  });
  return Notification;
};
