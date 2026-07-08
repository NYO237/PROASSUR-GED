const express = require('express');
const multer = require('multer');
const authenticateToken = require('../middleware/authMiddleware');
const { createDemande, afficherDemandes_en_attente,afficherDemandes_valides, afficherDemandes_rejetes,afficherToutesDemandes_en_attente,afficherToutesDemandes_valides,afficherToutesDemandes_rejetes, afficher_nb_demandes, afficher_nb_demandes_valides,afficher_nb_demandes_rejetes , validerDemande,rejeterDemande} = require('../controllers/demandeController');


const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const uploadFields = upload.fields([
  { name: 'cni', maxCount: 1 },
  { name: 'input-permis', maxCount: 1 },
  { name: 'input-carte-grise', maxCount: 1 },
]);


// NOUVELLE DEMANDES
router.post('/nouvelledemande', authenticateToken, uploadFields, createDemande);

// SUIVIE DEMANDES(CLIENT)
router.get('/suivi_demandes_en_attente',authenticateToken, afficherDemandes_en_attente);
router.get('/suivi_demandes_valides',authenticateToken, afficherDemandes_valides);
router.get('/suivi_demandes_rejetes',authenticateToken, afficherDemandes_rejetes);

// DEMANDES RECUES(EMPLOYE)
router.get('/demandes_recues_en_attente',authenticateToken, afficherToutesDemandes_en_attente);
router.get('/demandes_recues_valides',authenticateToken, afficherToutesDemandes_valides);
router.get('/demandes_recues_rejetes',authenticateToken, afficherToutesDemandes_rejetes);
router.put('/valider_demande', authenticateToken, validerDemande);
router.put('/rejeter_demande', authenticateToken, rejeterDemande);




// ACCUEIL
router.get('/nb_demandes', authenticateToken, afficher_nb_demandes);
router.get('/nb_demandes_valides', authenticateToken, afficher_nb_demandes_valides);
router.get('/nb_demandes_rejetes', authenticateToken, afficher_nb_demandes_rejetes);





module.exports = router;
