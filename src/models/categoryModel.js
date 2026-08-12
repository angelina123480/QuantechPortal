const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');

async function list() {
  const res = await pool.query('SELECT * FROM categories ORDER BY name ASC');
  return res.rows.map((r) => ({ name: r.name, description: r.description }));
}

async function listNames() {
  const categories = await list();
  return categories.map((c) => c.name);
}

async function listWithSubcategories() {
  const [categories, subcategories] = await Promise.all([
    pool.query('SELECT * FROM categories ORDER BY name ASC'),
    pool.query('SELECT * FROM subcategories ORDER BY name ASC'),
  ]);
  const subsByCategory = {};
  for (const s of subcategories.rows) {
    (subsByCategory[s.category_name] = subsByCategory[s.category_name] || []).push({ id: s.id, name: s.name });
  }
  return categories.rows.map((c) => ({ name: c.name, description: c.description, subcategories: subsByCategory[c.name] || [] }));
}

async function findSubcategory(id) {
  const res = await pool.query('SELECT * FROM subcategories WHERE id = $1', [id]);
  return res.rows.length ? { id: res.rows[0].id, categoryName: res.rows[0].category_name, name: res.rows[0].name } : null;
}

async function create(data) {
  await pool.query('INSERT INTO categories (name, description, created_at) VALUES ($1,$2,now())', [data.name, data.description || null]);
  return { name: data.name, description: data.description || null };
}

async function update(name, data) {
  await pool.query('UPDATE categories SET description = $1 WHERE name = $2', [data.description || null, name]);
  return { name, description: data.description || null };
}

async function remove(name) {
  await pool.query('DELETE FROM categories WHERE name = $1', [name]);
}

async function addSubcategory(categoryName, name) {
  const id = uuidv4();
  await pool.query('INSERT INTO subcategories (id, category_name, name) VALUES ($1,$2,$3)', [id, categoryName, name]);
  return { id, categoryName, name };
}

async function removeSubcategory(id) {
  await pool.query('DELETE FROM subcategories WHERE id = $1', [id]);
}

module.exports = { list, listNames, listWithSubcategories, findSubcategory, create, update, remove, addSubcategory, removeSubcategory };
