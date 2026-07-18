const express = require("express")
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const {afficher_infos,enregistrer_modification} = require('../controllers/profilController')
const {afficher_infos_employe,enregistrer_modification_employe,afficher_statistiques_employe} = require('../controllers/profilEmployeController')

router.get('/afficherprofil',authenticateToken,afficher_infos);
router.post('/enregister_modifications',authenticateToken,enregistrer_modification)

router.get('/afficherprofil_employe',authenticateToken,afficher_infos_employe);
router.post('/enregister_modifications_employe',authenticateToken,enregistrer_modification_employe)
router.get('/statistiques_employe',authenticateToken,afficher_statistiques_employe);


module.exports = router;