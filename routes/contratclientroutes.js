// routes/contratClientRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { afficherMesContrats, afficherMesNotifications, afficherDetailsMonContrat } = require('../controllers/contratClientController');

router.get('/mes_contrats', authenticateToken, afficherMesContrats);
router.get('/mes_notifications', authenticateToken, afficherMesNotifications);
router.get('/details/:id', authenticateToken, afficherDetailsMonContrat);

module.exports = router;