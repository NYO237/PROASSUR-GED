// routes/rapportJournalierRoutes.js
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const auth     = require('../middleware/authMiddleware');
const ctrl     = require('../controllers/Rapportjournaliercontroller');

// Multer mémoire (même que scanRoutes)
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/rapport-journalier/scan
// Champs : encaissements (PDF), commissions (PDF, optionnel)
router.post(
  '/scan',
  auth,
  upload.fields([
    { name: 'encaissements', maxCount: 1 },
    { name: 'commissions',   maxCount: 1 },
  ]),
  ctrl.scannerRapportJournalier
);

// GET /api/rapport-journalier?date=2026-06-28
router.get('/', auth, ctrl.getRapportJournalier);

// PATCH /api/rapport-journalier/:date  (mise à jour manuelle)
router.patch('/:date', auth, ctrl.mettreAJourRapport);

// GET /api/rapport-journalier/export?date=2026-06-28
router.get('/export', auth, ctrl.exporterRapportExcel);

module.exports = router;