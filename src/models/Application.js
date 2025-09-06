module.exports = (sequelize, DataTypes) => {
  const Application = sequelize.define("Application", {
    status: DataTypes.ENUM("applied", "shortlisted", "interview", "rejected", "hired"),
    appliedAt: DataTypes.DATE,
  });
  return Application;
};
