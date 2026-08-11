const { Pool } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill in a Postgres connection string.');
}

// Neon's HTTP/WebSocket-based driver — talks over :443 instead of a raw
// Postgres TCP socket, which is what lets this run in serverless/edge
// environments (and sandboxes) that don't allow arbitrary outbound ports.
// The query interface is drop-in compatible with node-postgres's Pool.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

module.exports = pool;
