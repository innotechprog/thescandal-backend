const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Comment = sequelize.define(
  'Comment',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    postId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    placeMentioned: {
      type: DataTypes.STRING(140),
      allowNull: true,
    },
    topicKeywords: {
      type: DataTypes.ARRAY(DataTypes.STRING(60)),
      defaultValue: [],
      allowNull: false,
    },
    media: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      defaultValue: [],
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'comments',
    timestamps: false,
  }
);

Comment.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  return values;
};

module.exports = Comment;
