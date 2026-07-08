const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { listerNotifications } = require('../controllers/notificationsController');

// Accessible à TOUS les employés (chef d'agence ou non) - pas de requireChefAgence ici
router.get('/', authenticateToken, listerNotifications);

module.exports = router;