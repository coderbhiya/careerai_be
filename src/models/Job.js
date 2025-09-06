// models/job.js
module.exports = (sequelize, DataTypes) => {
  const Job = sequelize.define("Job", {
    title: DataTypes.STRING,
    company: DataTypes.STRING,
    location: DataTypes.STRING,
    salaryRange: DataTypes.STRING,
    employmentType: DataTypes.ENUM("full-time", "part-time", "contract", "internship"),
    description: DataTypes.TEXT,
    requirements: DataTypes.TEXT,
    industry: DataTypes.STRING,
    seniority: DataTypes.ENUM("junior", "mid", "senior", "lead"),
    remote: DataTypes.BOOLEAN,
  });
  return Job;
};
