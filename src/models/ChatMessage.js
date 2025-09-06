// models/chatMessage.js
module.exports = (sequelize, DataTypes) => {
  const ChatMessage = sequelize.define("ChatMessage", {
    sender: DataTypes.ENUM("user", "ai"),
    message: DataTypes.TEXT,
  });
  return ChatMessage;
};
