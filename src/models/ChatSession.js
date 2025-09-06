// models/chatSession.js
module.exports = (sequelize, DataTypes) => {
  const ChatSession = sequelize.define("ChatSession", {
    topic: DataTypes.STRING,
  });
  return ChatSession;
};
