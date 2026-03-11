const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Admin = sequelize.define(
  'Admin',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    // bcrypt-hashed password — never store plaintext
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    tableName: 'admins',
    timestamps: true,
    updatedAt: false,
  }
);

// Never expose the password hash in JSON responses
Admin.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = Admin;
