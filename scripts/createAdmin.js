/**
 * Interactive CLI script to create an admin account.
 *
 * Usage:
 *   cd thescandal-backend
 *   npm run create-admin
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const readline = require('readline');
const bcrypt = require('bcryptjs');
const sequelize = require('../db');
const Admin = require('../models/Admin');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function prompt(q) { return new Promise((r) => rl.question(q, r)); }

async function main() {
  console.log('\n=== TheScandal Admin Account Creator ===\n');

  await sequelize.authenticate();
  await sequelize.sync();
  console.log('Connected to PostgreSQL.\n');

  const username = (await prompt('Admin username: ')).trim();
  if (!username || username.length < 3) {
    console.error('Username must be at least 3 characters.');
    process.exit(1);
  }

  const existing = await Admin.findOne({ where: { username } });
  if (existing) {
    console.error(`Admin "${username}" already exists.`);
    process.exit(1);
  }

  const password = (await prompt('Admin password (min 12 chars): ')).trim();
  if (password.length < 12) {
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }

  const confirm = (await prompt('Confirm password: ')).trim();
  if (password !== confirm) {
    console.error('Passwords do not match.');
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 12);
  await Admin.create({ username, password: hashed });

  console.log(`\nAdmin account "${username}" created successfully.\n`);
  rl.close();
  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
