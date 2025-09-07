module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
    name: DataTypes.STRING,
    email: { type: DataTypes.STRING, unique: true },
    password: DataTypes.STRING,
    firebaseUid: { type: DataTypes.STRING, unique: true },
    phone: { type: DataTypes.STRING, unique: true },
    role: { type: DataTypes.ENUM("candidate", "admin", "recruiter"), defaultValue: "candidate" },
    isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    isMobileVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    otp: DataTypes.STRING,
    otpExpires: DataTypes.DATE,
  });
  return User;
};
