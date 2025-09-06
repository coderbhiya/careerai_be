module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
    name: DataTypes.STRING,
    email: { type: DataTypes.STRING, unique: true },
    password: DataTypes.STRING,
    role: { type: DataTypes.ENUM("candidate", "admin", "recruiter"), defaultValue: "candidate" },
    isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    otp: DataTypes.STRING,
    otpExpires: DataTypes.DATE,
  });
  return User;
};
