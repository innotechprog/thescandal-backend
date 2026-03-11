require('dotenv').config();

const sequelize = require('../db');

async function patchAdsSchema() {
  await sequelize.authenticate();

  await sequelize.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS email VARCHAR(200);');
  await sequelize.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS "adType" VARCHAR(20) NOT NULL DEFAULT \'banner\';');
  await sequelize.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS description TEXT;');
  await sequelize.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];');
  await sequelize.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT \'approved\';');
  await sequelize.query('ALTER TABLE ads ADD COLUMN IF NOT EXISTS "reviewNote" VARCHAR(400);');

  console.log('ads schema patched');
}

patchAdsSchema()
  .then(() => sequelize.close())
  .catch(async (err) => {
    console.error('Failed to patch ads schema:', err.message);
    await sequelize.close();
    process.exit(1);
  });
