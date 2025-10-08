module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define("Notification", {
    // High-level category/type for the notification
    type: DataTypes.ENUM("job_alert", "application_update", "ai_tip", "skill_improvement", "common"),
    // Optional short title
    title: { type: DataTypes.STRING, allowNull: true },
    // Detailed message/body
    message: { type: DataTypes.TEXT, allowNull: false },
    // Optional link (e.g., job detail, profile page)
    link: { type: DataTypes.STRING, allowNull: true },
    // Broadcast to all users
    targetAll: { type: DataTypes.BOOLEAN, defaultValue: false },
    // Read state (applies to user-specific notifications)
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    // Extra structured data if needed
    metadata: { type: DataTypes.JSON, allowNull: true },
    // Target user id when not broadcasting
    userId: { type: DataTypes.INTEGER, allowNull: true },
  });
  return Notification;
};
