const pool = require('../data/db');

function mapArticleRow(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    summary: row.summary,
    body: row.body,
    tags: row.tags,
    updatedAt: row.updated_at,
  };
}

async function list(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.category) {
    params.push(filters.category);
    clauses.push(`category = $${params.length}`);
  }
  if (filters.search) {
    const q = `%${filters.search.trim().toLowerCase()}%`;
    params.push(q);
    const p = `$${params.length}`;
    clauses.push(`(lower(title) LIKE ${p} OR lower(summary) LIKE ${p} OR lower(body) LIKE ${p} OR EXISTS (SELECT 1 FROM unnest(tags) tag WHERE lower(tag) LIKE ${p}))`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const res = await pool.query(`SELECT * FROM articles ${where} ORDER BY updated_at DESC`, params);
  return res.rows.map(mapArticleRow);
}

async function findById(id) {
  const res = await pool.query('SELECT * FROM articles WHERE id = $1', [id]);
  return res.rows.length ? mapArticleRow(res.rows[0]) : null;
}

module.exports = { list, findById };
