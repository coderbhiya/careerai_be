module.exports = (sequelize, DataTypes) => {
  const ChatMessage = sequelize.define("ChatMessage", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("user", "assistant"),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    threadId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hasAttachments: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  });
  return ChatMessage;
};
