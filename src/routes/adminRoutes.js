const express = require('express');
const adminController = require('../controllers/adminController');
const { requireLogin, requireStaff } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireLogin, requireStaff, adminController.dashboard);

module.exports = router;
