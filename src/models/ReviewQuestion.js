module.exports = (sequelize, DataTypes) => {
  const ReviewQuestion = sequelize.define(
    "ReviewQuestion",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      text: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      displayOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      type: {
        type: DataTypes.ENUM("likert", "single_choice", "multi_choice", "text", "rating"),
        defaultValue: "likert",
        allowNull: false,
      },
      allowMultiple: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      options: {
        // For choice types: array of strings
        type: DataTypes.JSON,
        allowNull: true,
      },
      minValue: {
        // For rating type
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      maxValue: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 5,
      },
    },
    {
      timestamps: true,
      tableName: "review_questions",
    }
  );  

  return ReviewQuestion;
};