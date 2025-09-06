module.exports = (sequelize, DataTypes) => {
  const Certification = sequelize.define("Certification", {
    name: DataTypes.STRING,
    provider: DataTypes.STRING,
    issuedDate: DataTypes.DATE,
    url: DataTypes.STRING,
  });
  return Certification;
};
