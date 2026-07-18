const express = require("express");
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requireChefAgence } = require('../middleware/authMiddleware');
const {
    afficher_infos_clients,
    afficher_infos_employes,
    supprimerUtilisateur,
    basculerStatus,
    modifierUtilisateur,
    creerUtilisateur,
    statistiquesClient,
    statistiquesEmploye,
} = require('../controllers/utilisateursController');

// Toutes les routes de gestion des utilisateurs sont réservées aux chefs d'agence
router.use(authenticateToken, requireChefAgence);

router.get('/afficher_infos_clients', afficher_infos_clients);
router.get('/afficher_infos_employes', afficher_infos_employes);
router.get('/stats_client/:id', statistiquesClient);
router.get('/stats_employe/:id', statistiquesEmploye);

router.post('/creer', creerUtilisateur);
router.delete('/supprimer/:id', supprimerUtilisateur);
router.patch('/basculer_status/:id', basculerStatus);
router.put('/modifier/:id', modifierUtilisateur);

module.exports = router;