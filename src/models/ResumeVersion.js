module.exports = (sequelize, DataTypes) => {
  const ResumeVersion = sequelize.define("ResumeVersion", {
    fileUrl: DataTypes.STRING,
    highlights: DataTypes.TEXT,
  });
  return ResumeVersion;
};
