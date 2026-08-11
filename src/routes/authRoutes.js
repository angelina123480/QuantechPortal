const express = require('express');
const authController = require('../controllers/authController');
const { redirectIfAuthenticated, requireLogin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/login', redirectIfAuthenticated, authController.showLogin);
router.post('/login', redirectIfAuthenticated, asyncHandler(authController.login));
router.post('/logout', requireLogin, authController.logout);

module.exports = router;
