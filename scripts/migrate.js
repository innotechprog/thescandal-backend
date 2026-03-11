#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../db');
const { getMigrator } = require('../migrations/migrator');

async function main() {
  const command = (process.argv[2] || 'up').toLowerCase();
  const migrator = getMigrator();

  await sequelize.authenticate();

  if (command === 'up') {
    const applied = await migrator.up();
    console.log(`[migrate] Applied ${applied.length} migration(s)`);
  } else if (command === 'down') {
    const reverted = await migrator.down();
    console.log('[migrate] Reverted migration:', reverted ? reverted.name : 'none');
  } else if (command === 'status') {
    const [executed, pending] = await Promise.all([migrator.executed(), migrator.pending()]);
    console.log('\nExecuted migrations:');
    if (!executed.length) console.log('- none');
    for (const m of executed) console.log(`- ${m.name}`);

    console.log('\nPending migrations:');
    if (!pending.length) console.log('- none');
    for (const m of pending) console.log(`- ${m.name}`);
  } else {
    console.error('[migrate] Unknown command. Use: up | down | status');
    process.exitCode = 1;
  }

  await sequelize.close();
}

main().catch(async (err) => {
  console.error('[migrate] Error:', err.message);
  try {
    await sequelize.close();
  } catch (_) {
    // noop
  }
  process.exit(1);
});
