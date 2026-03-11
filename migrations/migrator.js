const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');
const sequelize = require('../db');

function getMigrator() {
  return new Umzug({
    migrations: {
      glob: path.join(__dirname, '*.cjs'),
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize, modelName: 'sequelize_meta' }),
    logger: console,
  });
}

async function runMigrations() {
  const migrator = getMigrator();
  const pending = await migrator.pending();

  if (!pending.length) {
    console.log('[migrations] No pending migrations');
    return [];
  }

  console.log(`[migrations] Applying ${pending.length} migration(s)...`);
  const executed = await migrator.up();
  console.log(`[migrations] Applied ${executed.length} migration(s)`);
  return executed;
}

module.exports = {
  getMigrator,
  runMigrations,
};
