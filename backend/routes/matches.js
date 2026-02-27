const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/matchController');

router.use(apiLimiter);

router.get('/hoy', optionalAuth, ctrl.getTodayMatches);
router.get('/proximos', optionalAuth, ctrl.getUpcomingMatches);
router.get('/en-vivo', optionalAuth, ctrl.getLiveMatches);
router.get('/h2h', optionalAuth, ctrl.getH2H);
router.get('/:id', optionalAuth, ctrl.getMatchById);
router.get('/:id/analisis', authenticate, ctrl.getMatchAnalysis);
router.get('/:id/apuestas-sugeridas', authenticate, ctrl.getSuggestedBets);

module.exports = router;
