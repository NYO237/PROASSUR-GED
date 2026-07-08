// routes/productionRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { getProductionSemaine, exporterProductionExcel } = require('../controllers/productionController');

router.get('/semaine', authenticateToken, getProductionSemaine);
router.get('/export', authenticateToken, exporterProductionExcel);

module.exports = router;
