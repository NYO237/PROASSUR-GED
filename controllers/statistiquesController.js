// controllers/statistiquesController.js
const statistiquesService = require('../services/StatistiquesService');

// GET /api/statistiques/synthese?periode=jour|semaine|mois|tout
async function getSynthese(req, res) {
  try {
    const data = await statistiquesService.getCartesSynthese(req.query.periode);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error('[statistiquesController] Erreur synthese :', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// GET /api/statistiques/evolution?periode=jour|semaine|mois|tout
async function getEvolution(req, res) {
  try {
    const data = await statistiquesService.getEvolution(req.query.periode);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error('[statistiquesController] Erreur evolution :', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

module.exports = { getSynthese, getEvolution };