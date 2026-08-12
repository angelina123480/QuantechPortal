const { v4: uuidv4 } = require('uuid');
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
    status: row.status,
    authorId: row.author_id,
    viewCount: row.view_count,
  };
}

/**
 * By default only published articles are returned (client-facing KB browse
 * and search). Pass includeDrafts: true for the admin management screen.
 */
async function list(filters = {}) {
  const clauses = [];
  const params = [];

  if (!filters.includeDrafts) {
    clauses.push("status = 'published'");
  } else if (filters.status) {
    params.push(filters.status);
    clauses.push(`status = $${params.length}`);
  }
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

async function incrementViewCount(id) {
  await pool.query('UPDATE articles SET view_count = view_count + 1 WHERE id = $1', [id]);
}

async function create(data, author) {
  const id = uuidv4();
  const res = await pool.query(
    `INSERT INTO articles (id, title, category, summary, body, tags, updated_at, status, author_id, view_count)
     VALUES ($1,$2,$3,$4,$5,$6,now(),$7,$8,0) RETURNING *`,
    [id, data.title, data.category, data.summary, data.body, data.tags || [], data.status || 'draft', author.id]
  );
  return mapArticleRow(res.rows[0]);
}

async function update(id, data) {
  const allowed = ['title', 'category', 'summary', 'body', 'tags', 'status'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (sets.length === 0) return findById(id);
  sets.push('updated_at = now()');
  params.push(id);
  const res = await pool.query(`UPDATE articles SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
  return res.rows.length ? mapArticleRow(res.rows[0]) : null;
}

async function remove(id) {
  await pool.query('DELETE FROM articles WHERE id = $1', [id]);
}

module.exports = { list, findById, incrementViewCount, create, update, remove };
