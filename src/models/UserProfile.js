module.exports = (sequelize, DataTypes) => {
  const UserProfile = sequelize.define("UserProfile", {
    headline: DataTypes.STRING,
    bio: DataTypes.TEXT,
    experienceYears: DataTypes.INTEGER,
    currentRole: DataTypes.STRING,
    targetRole: DataTypes.STRING,
    targetIndustry: DataTypes.STRING,
    location: DataTypes.STRING,
    resumeUrl: DataTypes.STRING,
  });
  return UserProfile;
};
