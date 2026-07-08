const express = require("express");
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const {
    rechercherContrats,
} = require('../controllers/contratsEmployeController');

router.get('/rechercher', authenticateToken, rechercherContrats);

module.exports = router;