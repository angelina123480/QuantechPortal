const express = require('express');
const kbController = require('../controllers/kbController');
const { requireLogin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', requireLogin, asyncHandler(kbController.index));
router.get('/:id', requireLogin, asyncHandler(kbController.show));

module.exports = router;
