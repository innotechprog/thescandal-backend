require('dotenv').config();

const sequelize = require('../db');

async function patchPostCommentSchema() {
  await sequelize.authenticate();

  await sequelize.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS country VARCHAR(100);');
  await sequelize.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS "placeMentioned" VARCHAR(140);');
  await sequelize.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS "topicKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];');

  await sequelize.query('ALTER TABLE comments ADD COLUMN IF NOT EXISTS country VARCHAR(100);');
  await sequelize.query('ALTER TABLE comments ADD COLUMN IF NOT EXISTS "placeMentioned" VARCHAR(140);');
  await sequelize.query('ALTER TABLE comments ADD COLUMN IF NOT EXISTS "topicKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];');

  console.log('post/comment schema patched');
}

patchPostCommentSchema()
  .then(() => sequelize.close())
  .catch(async (err) => {
    console.error('Failed to patch post/comment schema:', err.message);
    await sequelize.close();
    process.exit(1);
  });
