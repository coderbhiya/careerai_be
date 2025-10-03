module.exports = (sequelize, DataTypes) => {
  const UserSkill = sequelize.define("UserSkill", {
    proficiency: {
      type: DataTypes.ENUM("beginner", "intermediate", "expert"),
    },
    skillScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  });
  return UserSkill;
};
