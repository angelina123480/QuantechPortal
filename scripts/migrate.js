require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('@neondatabase/serverless');

async function migrate() {
  // Migrations run DDL once at setup time — use the unpooled connection so
  // pgbouncer's statement pooling doesn't get in the way.
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const dir = path.join(__dirname, '..', 'src', 'data', 'migrations');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await client.query(sql);
    }

    console.log('Migrations complete.');
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
