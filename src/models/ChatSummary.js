module.exports = (sequelize, DataTypes) => {
  const ChatSummary = sequelize.define("ChatSummary", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true, // one active summary per user
    },
    summary: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    // The id of the last ChatMessage that was included in this summary.
    // All messages with id <= lastMessageId have been summarized.
    lastMessageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // How many messages were compressed into this summary
    messageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  });

  return ChatSummary;
};
