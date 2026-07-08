// routes/contratClientRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { afficherMesContrats, afficherMesNotifications } = require('../controllers/contratClientController');

router.get('/mes_contrats', authenticateToken, afficherMesContrats);
router.get('/mes_notifications', authenticateToken, afficherMesNotifications);

module.exports = router;