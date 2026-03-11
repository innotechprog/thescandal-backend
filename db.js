const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT, 10) || 5432,
  database: process.env.PG_DB || 'thescandal',
  username: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  logging: false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
});

module.exports = sequelize;
