// routes/statistiquesRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { getSynthese, getEvolution } = require('../controllers/statistiquesController');

router.get('/synthese', authenticateToken, getSynthese);
router.get('/evolution', authenticateToken, getEvolution);

module.exports = router;
