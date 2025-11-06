module.exports = (sequelize, DataTypes) => {
  const ReviewAnswer = sequelize.define(
    "ReviewAnswer",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      reviewId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      questionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      answer: {
        // Flexible JSON to store value(s) depending on question type
        // Example: { type: 'likert', value: 'satisfied' } or { type: 'multi_choice', values: ['A','B'] } or { type: 'text', value: '...' }
        type: DataTypes.JSON,
        allowNull: false,
      },
    },
    {
      timestamps: true,
      tableName: "review_answers",
    }
  );

  return ReviewAnswer;
};