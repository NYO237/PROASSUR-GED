// routes/statistiquesRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { getSynthese, getEvolution, getTopEmployes } = require('../controllers/statistiquesController');

router.get('/synthese', authenticateToken, getSynthese);
router.get('/evolution', authenticateToken, getEvolution);
router.get('/top-employes', authenticateToken, getTopEmployes);

module.exports = router;