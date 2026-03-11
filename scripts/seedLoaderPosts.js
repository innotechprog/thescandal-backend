require('dotenv').config();

const sequelize = require('../db');
const Post = require('../models/Post');

async function seed() {
  await sequelize.authenticate();

  const now = Date.now();
  const rows = Array.from({ length: 30 }, (_, i) => ({
    username: `LoaderTestUser${String(i + 1).padStart(2, '0')}`,
    content: `Loader test post #${i + 1} - sample scandal narrative for infinite scroll testing.`,
    media: [],
    flagged: false,
    likes: Math.floor(Math.random() * 25),
    country: null,
    placeMentioned: null,
    topicKeywords: ['loader', 'test', 'scroll'],
    timestamp: new Date(now - i * 60_000),
  }));

  await Post.bulkCreate(rows);
  const total = await Post.count();
  console.log('inserted=30');
  console.log(`total_posts=${total}`);
}

seed()
  .then(() => sequelize.close())
  .catch(async (err) => {
    console.error(err.message);
    await sequelize.close();
    process.exit(1);
  });
