const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Post = sequelize.define(
  'Post',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    media: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      defaultValue: [],
    },
    flagged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    likes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
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
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'posts',
    timestamps: false,
  }
);

// Adds _id alias so the existing frontend code (which uses post._id) keeps working
Post.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  return values;
};

module.exports = Post;
