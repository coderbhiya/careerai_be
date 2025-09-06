module.exports = (sequelize, DataTypes) => {
  const ApplicationFeedback = sequelize.define("ApplicationFeedback", {
    feedback: DataTypes.TEXT,
    source: DataTypes.ENUM("recruiter", "system", "ai"),
  });
  return ApplicationFeedback;
};
