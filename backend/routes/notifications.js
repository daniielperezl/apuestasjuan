const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getUnreadNotifications, markAsRead } = require('../services/notificationService');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const notifications = await getUnreadNotifications(req.user.id);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

router.put('/:id/leer', async (req, res) => {
  try {
    await markAsRead(req.user.id, req.params.id);
    res.json({ message: 'Notificación marcada como leída' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar notificación' });
  }
});

module.exports = router;
