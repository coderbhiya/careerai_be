// models/userSkill.js
module.exports = (sequelize, DataTypes) => {
  const UserSkill = sequelize.define("UserSkill", {
    proficiency: DataTypes.ENUM("beginner", "intermediate", "expert"),
  });
  return UserSkill;
};
