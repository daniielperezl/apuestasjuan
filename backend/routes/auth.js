const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { loginLimiter, strictLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/authController');

router.post('/register', strictLimiter, ...ctrl.registerValidation, ctrl.register);
router.post('/login', loginLimiter, ...ctrl.loginValidation, ctrl.login);
router.post('/login/2fa', loginLimiter, ctrl.loginWith2FA);
router.post('/refresh-token', ctrl.refreshToken);
router.post('/logout', authenticate, ctrl.logout);
router.get('/profile', authenticate, ctrl.getProfile);
router.put('/profile', authenticate, ctrl.updateProfile);
router.post('/2fa/setup', authenticate, ctrl.setup2FA);
router.post('/2fa/verify', authenticate, ctrl.verify2FA);

module.exports = router;
