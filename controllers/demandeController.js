const fs = require('fs');
const cloudinary = require('../config/cloudinary');
const demandeService = require('../services/DemandeService');

async function uploadToCloudinary(fichierLocal) {
  const result = await cloudinary.uploader.upload(fichierLocal.path, {
    folder: 'proassur_clients',
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  });

  fs.unlinkSync(fichierLocal.path);
  return result.secure_url;
}

async function createDemande(req, res) {
  try {
    if (!req.files || !req.files.cni || !req.files['input-carte-grise']) {
      return res.status(400).json({ success: false, message: 'Documents obligatoires manquants.' });
    }

    if (req.user.role !== 'client') {
      return res.status(403).json({ success: false, message: 'Seuls les clients peuvent soumettre une demande.' });
    }

    // Durée du contrat souhaitée, choisie dans le formulaire (select "duree").
    // On valide côté serveur avant les uploads Cloudinary (échec rapide).
    const dureesAutorisees = [2, 4, 6, 8, 12];
    const dureeMois = parseInt(req.body.duree, 10);

    if (!dureesAutorisees.includes(dureeMois)) {
      return res.status(400).json({
        success: false,
        message: 'Durée de contrat invalide. Choisissez 2, 4, 6, 8 ou 12 mois.',
      });
    }

    // Garanties cochées dans le formulaire (checkboxes name="garanties").
    // multer ne renvoie un tableau que s'il y a 2+ occurrences du champ ;
    // avec une seule case cochée on reçoit une simple chaîne, d'où la
    // normalisation ci-dessous.
    let garanties = req.body.garanties || [];
    if (!Array.isArray(garanties)) {
      garanties = [garanties];
    }
    garanties = garanties.map((g) => (g || '').trim()).filter(Boolean);

    // Garantie tapée librement par le client si elle ne figure pas dans la liste.
    const autreGarantie = (req.body.autre_garantie || '').trim();
    if (autreGarantie) {
      garanties.push(autreGarantie);
    }

    // Dédoublonnage (ex : le client coche "Défense et Recours" ET retape
    // exactement la même chose dans le champ libre par erreur).
    garanties = [...new Set(garanties)];

    // Case à cocher "Vignette payée" : absente du body si décochée.
    const vignettePayee = ['1', 'true', 'on', 'oui'].includes(
      String(req.body.vignette_payee || '').toLowerCase()
    );

    const urlCni = await uploadToCloudinary(req.files.cni[0]);
    const urlCarteGrise = await uploadToCloudinary(req.files['input-carte-grise'][0]);

    let urlPermis = null;
    if (req.files['input-permis']) {
      urlPermis = await uploadToCloudinary(req.files['input-permis'][0]);
    }

    const idDemande = await demandeService.createDemande({
      idClient: req.user.id,
      urlCni,
      urlPermis,
      urlCarteGrise,
      dureeMois,
      garanties,
      vignettePayee,
    });

    return res.status(201).json({
      success: true,
      message: 'Demande enregistrée avec succès.',
      idDemande,
      dureeMois,
      garanties,
      vignettePayee,
      urls: {
        cni: urlCni,
        permis: urlPermis,
        carteGrise: urlCarteGrise,
      },
    });
  } catch (error) {
    console.error('Erreur traitement fichiers :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur technique lors du stockage des documents.',
    });
  }
}


async function afficherDemandes_en_attente (req,res){
    try{

        // Dans demandeController.js - Ligne ~41
      // AVANT : const demandes = await demandeService.afficherDemandes(req.user.id);

      // APRÈS : On passe un objet avec la propriété idClient
    const demandes = await demandeService.afficherDemandes_en_attente({ idClient: req.user.id });
        return res.status(200).json(
            {
                success : true,
                message : 'Demandes EN ATTENTE affichees avec succes ',
                demandes,
            }
        );
    }catch(error){
        console.log('Erreur affichage des demandes :' + error);
        return res.status(400).json(
            {
                success:false,
                message: `Erreur Serveur pour l'affichage des demandes EN ATTENTE`
            }
        )
    }
}
async function afficherDemandes_valides (req,res){
    try{

        // Dans demandeController.js - Ligne ~41
      // AVANT : const demandes = await demandeService.afficherDemandes(req.user.id);

      // APRÈS : On passe un objet avec la propriété idClient
    const demandes = await demandeService.afficherDemandes_valides({ idClient: req.user.id });
        return res.status(200).json(
            {
                success : true,
                message : 'Demandes VALIDES affichees avec succes ',
                demandes,
            }
        );
    }catch(error){
        console.log('Erreur affichage des demandes :' + error);
        return res.status(400).json(
            {
                success:false,
                message: `Erreur Serveur pour l'affichage des demandes VALIDES`
            }
        )
    }
}
async function afficherDemandes_rejetes (req,res){
    try{

        // Dans demandeController.js - Ligne ~41
      // AVANT : const demandes = await demandeService.afficherDemandes(req.user.id);

      // APRÈS : On passe un objet avec la propriété idClient
    const demandes = await demandeService.afficherDemandes_rejetes({ idClient: req.user.id });
        return res.status(200).json(
            {
                success : true,
                message : 'Demandes REJETES affichees avec succes ',
                demandes,
            }
        );
    }catch(error){
        console.log('Erreur affichage des demandes :' + error);
        return res.status(400).json(
            {
                success:false,
                message: `Erreur Serveur pour l'affichage des demandes REJETES`
            }
        )
    }
}
async function afficherToutesDemandes_en_attente (req,res){
    try{

        // Dans demandeController.js - Ligne ~41
      // AVANT : const demandes = await demandeService.afficherDemandes(req.user.id);

      // APRÈS : On passe un objet avec la propriété idClient
    const demandes = await demandeService.afficherToutesDemandes_en_attente();
        return res.status(200).json(
            {
                success : true,
                message : 'Demandes EN ATTENTE affichees avec succes ',
                demandes,
            }
        );
    }catch(error){
        console.log('Erreur affichage des demandes :' + error);
        return res.status(400).json(
            {
                success:false,
                message: `Erreur Serveur pour l'affichage des demandes EN ATTENTE`
            }
        )
    }
}


async function validerDemande(req, res) {
  try {
      const idDemande = req.body.id; // Récupère l'ID envoyé par le JSON du frontend
      
      if (!idDemande) {
          return res.status(400).json({ success: false, message: "ID de la demande manquant." });
      }

      // L'employé qui traite la demande est celui authentifié par le token :
      // on l'enregistre (id_employe) pour pouvoir ensuite compter les demandes
      // traitées par employé (statistiques). Avant ce correctif, id_employe
      // restait NULL pour toutes les demandes, quel que soit qui validait.
      await demandeService.validerDemande({ idDemande, idEmploye: req.user.id });
      
      return res.status(200).json({
          success : true,
          message : "Demande validée avec succès"
      });
    
  } catch (error) {
      console.log("Erreur serveur : " + error);
      return res.status(500).json({ // Passage en code 500 (Erreur Interne)
          success : false,
          message : "Erreur serveur pour la validation de la demande"
      });
  }
}
async function rejeterDemande(req, res) {
  try {
      const idDemande = req.body.id; // Récupère l'ID envoyé par le JSON du frontend
      const motif = (req.body.motif || '').trim(); // Motif saisi par l'employé dans la boîte de dialogue

      if (!idDemande) {
          return res.status(400).json({ success: false, message: "ID de la demande manquant." });
      }

      if (!motif) {
          return res.status(400).json({ success: false, message: "Le motif de rejet est obligatoire." });
      }

      // Même correctif que pour validerDemande : on enregistre l'employé qui rejette.
      await demandeService.rejeterDemande({ idDemande, motif, idEmploye: req.user.id });
      
      return res.status(200).json({
          success : true,
          message : "Demande rejetée avec succès"
      });
    
  } catch (error) {
      console.log("Erreur serveur : " + error);
      return res.status(500).json({ // Passage en code 500 (Erreur Interne)
          success : false,
          message : "Erreur serveur pour le rejet de la demande"
      });
  }
}


async function afficherToutesDemandes_valides (req,res){
    try{

    const demandes = await demandeService.afficherToutesDemandes_valides();
        return res.status(200).json(
            {
                success : true,
                message : 'Demandes VALIDES affichees avec succes ',
                demandes,
            }
        );
    }catch(error){
        console.log('Erreur affichage des demandes :' + error);
        return res.status(400).json(
            {
                success:false,
                message: `Erreur Serveur pour l'affichage des demandes VALIDES`
            }
        )
    }
}
async function afficherToutesDemandes_rejetes (req,res){
    try{

        // Dans demandeController.js - Ligne ~41
      // AVANT : const demandes = await demandeService.afficherDemandes(req.user.id);

      // APRÈS : On passe un objet avec la propriété idClient
    const demandes = await demandeService.afficherToutesDemandes_rejetes();
        return res.status(200).json(
            {
                success : true,
                message : 'Demandes REJETES affichees avec succes ',
                demandes,
            }
        );
    }catch(error){
        console.log('Erreur affichage des demandes :' + error);
        return res.status(400).json(
            {
                success:false,
                message: `Erreur Serveur pour l'affichage des demandes REJETES`
            }
        )
    }
}


async function afficher_nb_demandes(req,res) {
  try{
    const nb_demandes = await demandeService.nb_demandes({idClient : req.user.id});
    return res.status(200).json(
      {
        success : true,
        message : '',
        nb_demandes : nb_demandes,

      }
    )
  }catch(error){
    console.log(error)
    return res.status(200).json(
      {
        success : false,
        message : 'Erreur affichage nb_demandes',
      }
    )
  }
}

async function afficher_nb_demandes_valides(req,res) {
  try{
    const nb_demandes_valides = await demandeService.nb_demandes_valides({idClient : req.user.id});
    console.log(nb_demandes_valides.nb_demandes_valides)
    return res.status(200).json(
      {
        success : true,
        message : '',
        nb_demandes_valides : nb_demandes_valides,
      }
    )
  }catch(error){
    console.log(error)
    return res.status(200).json(
      {
        success : false,
        message : 'Erreur affichage nb_demandes_valides',
      }
    )
  }
}


async function afficher_nb_demandes_rejetes(req,res) {
  try{
    const nb_demandes_rejetes = await demandeService.nb_demandes_rejetes({idClient : req.user.id});
    console.log(nb_demandes_rejetes.nb_demandes_rejetes)
    return res.status(200).json(
      {
        success : true,
        message : '',
        nb_demandes_rejetes : nb_demandes_rejetes,
      }
    )
  }catch(error){
    console.log(error)
    return res.status(200).json(
      {
        success : false,
        message : 'Erreur affichage nb_demandes_rejetes',
      }
    )
  }
}


module.exports = {
  createDemande,
  afficherDemandes_en_attente,
  afficherDemandes_valides,
  afficherDemandes_rejetes,
  afficherToutesDemandes_en_attente,
  afficherToutesDemandes_valides,
  afficherToutesDemandes_rejetes,
  afficher_nb_demandes,
  afficher_nb_demandes_valides,
  afficher_nb_demandes_rejetes,
  validerDemande,
  rejeterDemande,
};