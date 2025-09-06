module.exports = (sequelize, DataTypes) => {
  const Experience = sequelize.define("Experience", {
    companyName: DataTypes.STRING,
    role: DataTypes.STRING,
    startDate: DataTypes.DATE,
    endDate: DataTypes.DATE,
    description: DataTypes.TEXT,
    achievements: DataTypes.TEXT,
  });
  return Experience;
};
