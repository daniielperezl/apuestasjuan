const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

router.use(authenticate, authorize('ADMIN', 'SUPERADMIN'));

router.get('/usuarios', ctrl.getUsers);
router.get('/usuarios/:id', ctrl.getUserById);
router.post('/usuarios', ctrl.createUser);
router.put('/usuarios/:id', ctrl.updateUser);
router.delete('/usuarios/:id', ctrl.deleteUser);
router.get('/reportes', ctrl.getReports);
router.get('/logs', ctrl.getAuditLogs);
router.post('/sincronizar', ctrl.syncMatchesManually);

module.exports = router;
