const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const matchRoutes = require('./matches');
const betRoutes = require('./bets');
const adminRoutes = require('./admin');
const notificationRoutes = require('./notifications');

router.use('/auth', authRoutes);
router.use('/encuentros', matchRoutes);
router.use('/apuestas', betRoutes);
router.use('/admin', adminRoutes);
router.use('/notificaciones', notificationRoutes);

router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    timezone: 'America/Bogota',
    bogotaTime: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  });
});

module.exports = router;
