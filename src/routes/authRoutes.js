const express = require('express');
const authController = require('../controllers/authController');
const { redirectIfAuthenticated, requireLogin } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/login', redirectIfAuthenticated, authController.showLogin);
router.post('/login', redirectIfAuthenticated, loginLimiter, asyncHandler(authController.login));
router.get('/login/verify-2fa', redirectIfAuthenticated, authController.showVerifyTwoFactor);
router.post('/login/verify-2fa', redirectIfAuthenticated, loginLimiter, asyncHandler(authController.verifyTwoFactor));
router.post('/logout', requireLogin, authController.logout);

router.get('/register', redirectIfAuthenticated, asyncHandler(authController.showRegister));
router.post('/register', redirectIfAuthenticated, asyncHandler(authController.register));

router.get('/forgot-password', redirectIfAuthenticated, authController.showForgotPassword);
router.post('/forgot-password', redirectIfAuthenticated, loginLimiter, asyncHandler(authController.forgotPassword));
router.get('/reset-password/:token', redirectIfAuthenticated, asyncHandler(authController.showResetPassword));
router.post('/reset-password/:token', redirectIfAuthenticated, asyncHandler(authController.resetPassword));

module.exports = router;
