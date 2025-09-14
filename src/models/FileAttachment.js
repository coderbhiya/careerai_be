module.exports = (sequelize, DataTypes) => {
  const FileAttachment = sequelize.define("FileAttachment", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    chatMessageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      get() {
        return `${process.env.APP_URL}/${this.getDataValue("filePath")}`;
      },
    },
    fileType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  });

  return FileAttachment;
};
