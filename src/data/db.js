const { Pool, neonConfig } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill in a Postgres connection string.');
}

// Route each query through a one-shot HTTPS fetch instead of a persistent
// WebSocket. A kept-open WebSocket doesn't play well with serverless
// functions that get frozen/recycled between invocations (it can hang
// indefinitely instead of failing fast) — fetch-per-query has no connection
// to go stale, which is what Neon recommends for this exact environment.
neonConfig.poolQueryViaFetch = true;

// Neon's HTTP-based driver — talks over :443 instead of a raw Postgres TCP
// socket, which is what lets this run in serverless/edge environments (and
// sandboxes) that don't allow arbitrary outbound ports. The query interface
// is drop-in compatible with node-postgres's Pool.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

module.exports = pool;
