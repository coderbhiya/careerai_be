module.exports = (sequelize, DataTypes) => {
  const Prompt = sequelize.define(
    "Prompt",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("chat", "skill", "system", "other"),
        defaultValue: "chat",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: "prompts",
      indexes: [
        { fields: ["type"] },
        { fields: ["isActive"] },
      ],
    }
  );

  return Prompt;
};