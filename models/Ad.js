const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Ad = sequelize.define(
  'Ad',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    businessName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    adType: {
      type: DataTypes.ENUM('banner', 'sponsoredPost'),
      defaultValue: 'banner',
      allowNull: false,
    },
    tagline: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    keywords: {
      type: DataTypes.ARRAY(DataTypes.STRING(60)),
      defaultValue: [],
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'approved',
      allowNull: false,
    },
    reviewNote: {
      type: DataTypes.STRING(400),
      allowNull: true,
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    linkUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'ads',
    timestamps: false,
  }
);

Ad.prototype.toJSON = function () {
  const v = { ...this.get() };
  v._id = v.id;
  return v;
};

module.exports = Ad;
