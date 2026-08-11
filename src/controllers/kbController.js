const articleModel = require('../models/articleModel');
const { CATEGORIES } = require('../config/constants');

async function index(req, res) {
  const { q = '', category = '' } = req.query;
  const articles = await articleModel.list({ search: q, category });

  res.render('kb/index', {
    title: 'Knowledge Base',
    articles,
    categories: CATEGORIES,
    query: q,
    activeCategory: category,
  });
}

async function show(req, res) {
  const article = await articleModel.findById(req.params.id);
  if (!article) {
    return res.status(404).render('errors/404', { title: 'Article not found' });
  }
  const related = (await articleModel.list({ category: article.category }))
    .filter((a) => a.id !== article.id)
    .slice(0, 4);

  res.render('kb/article', {
    title: article.title,
    article,
    related,
  });
}

module.exports = { index, show };
