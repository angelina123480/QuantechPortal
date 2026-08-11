const store = require('../data/store');

function list(filters = {}) {
  let articles = store.articles.slice();

  if (filters.category) {
    articles = articles.filter((a) => a.category === filters.category);
  }
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    articles = articles.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      a.body.toLowerCase().includes(q) ||
      a.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  return articles.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function findById(id) {
  return store.articles.find((a) => a.id === id) || null;
}

module.exports = { list, findById };
