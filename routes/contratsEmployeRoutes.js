const express = require("express");
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const {
    rechercherContrats,
    obtenirDetailsContrat,
} = require('../controllers/contratsEmployeController');

router.get('/rechercher', authenticateToken, rechercherContrats);
router.get('/details/:id', authenticateToken, obtenirDetailsContrat);

module.exports = router;