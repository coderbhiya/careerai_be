module.exports = (sequelize, DataTypes) => {
  const Skill = sequelize.define("Skill", {
    name: DataTypes.STRING,
    category: DataTypes.STRING,
  });
  return Skill;
};
