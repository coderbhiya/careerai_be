// models/job.js
module.exports = (sequelize, DataTypes) => {
  const Job = sequelize.define("Job", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    jobId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    title: DataTypes.STRING,
    company: DataTypes.STRING,
    companyLogo : DataTypes.STRING,
    companyWebsite : DataTypes.STRING,
    location: DataTypes.STRING,
    city: DataTypes.STRING,
    state: DataTypes.STRING,
    jobCountry: DataTypes.STRING,
    jobSalary: DataTypes.STRING,
    jobMinSalary: DataTypes.STRING,
    jobMaxSalary: DataTypes.STRING,
    employmentType: DataTypes.STRING,
    description: DataTypes.TEXT,
    link: DataTypes.STRING,
  });
  return Job;
};
