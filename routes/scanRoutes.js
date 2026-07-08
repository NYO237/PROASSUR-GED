const express = require('express');
const router = express.Router();
const multer = require('multer');
const { scannerLotDossiers } = require('../controllers/scanController');
const authenticateToken = require('../middleware/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/executer-scan', authenticateToken, upload.array('fichiers_lot'), scannerLotDossiers);

module.exports = router;