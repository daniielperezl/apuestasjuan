const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { strictLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/betController');

router.use(authenticate);

router.post('/crear', strictLimiter, ...ctrl.createBetValidation, ctrl.createBet);
router.get('/mis-apuestas', ctrl.getUserBets);
router.get('/estadisticas', ctrl.getUserStats);
router.get('/:id', ctrl.getBetById);
router.delete('/:id/cancelar', ctrl.cancelBet);

// Admin only
router.put('/:id/resolver', authorize('ADMIN', 'SUPERADMIN'), ctrl.resolveBet);

module.exports = router;
