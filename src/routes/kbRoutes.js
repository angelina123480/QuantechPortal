const express = require('express');
const kbController = require('../controllers/kbController');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireLogin, kbController.index);
router.get('/:id', requireLogin, kbController.show);

module.exports = router;
