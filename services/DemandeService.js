const pool = require('../config/db');

// Garanties proposées par défaut dans le formulaire de nouvelle demande.
// Sert uniquement à marquer est_personnalisee = 0/1 en base (les libellés
// tapés librement par le client via le champ "autre" sont, eux, personnalisés).
const GARANTIES_PAR_DEFAUT = ['Défense et Recours', 'Aide à la Réparation'];

// Calcule la date/heure locale du Cameroun (Afrique/Douala = UTC+1 toute
// l'année, pas d'heure d'été). On n'utilise plus CURDATE()/CURTIME() de
// MySQL car ces fonctions renvoient l'heure du SERVEUR DE BASE DE DONNEES
// (Aiven, en UTC par défaut), pas celle de l'utilisateur au Cameroun —
// d'où le décalage d'1h observé (11h30 -> enregistré 10h30).
function getDateHeureCameroun() {
  const maintenant = new Date();
  const localCameroun = new Date(maintenant.getTime() + 60 * 60 * 1000);

  const date = localCameroun.toISOString().slice(0, 10); // YYYY-MM-DD
  const heure = localCameroun.toISOString().slice(11, 19); // HH:MM:SS

  return { date, heure };
}

async function createDemande({ idClient, urlCni, urlPermis, urlCarteGrise, dureeMois, garanties = [], vignettePayee = false }) {
  const { date, heure } = getDateHeureCameroun();

  const [result] = await pool.query(
    `INSERT INTO demande_contrat (date_demande, heure_demande, statut_demande, url_cni, url_permis, url_carte_grise, duree_mois, vignette_payee, id_client)
     VALUES (?, ?, 'En attente', ?, ?, ?, ?, ?, ?)`,
    [date, heure, urlCni, urlPermis, urlCarteGrise, dureeMois, vignettePayee ? 1 : 0, idClient]
  );

  const idDemande = result.insertId;

  if (garanties.length) {
    const lignes = garanties.map((libelle) => [
      idDemande,
      libelle,
      GARANTIES_PAR_DEFAUT.includes(libelle) ? 0 : 1,
    ]);
    await pool.query(
      `INSERT INTO demande_garantie (id_demande, libelle, est_personnalisee) VALUES ?`,
      [lignes]
    );
  }

  return idDemande;
}

// Récupère les garanties liées à un lot de demandes et les rattache à
// chaque demande (garanties: [...]) tout en normalisant vignette_payee en
// booléen. Utilisé par toutes les fonctions d'affichage ci-dessous.
async function _attacherGarantiesEtVignette(demandes) {
  if (!demandes.length) return demandes;

  const ids = demandes.map((d) => d.id_demande);
  const [lignesGaranties] = await pool.query(
    `SELECT id_demande, libelle, est_personnalisee FROM demande_garantie WHERE id_demande IN (?)`,
    [ids]
  );

  const garantiesParDemande = new Map();
  for (const ligne of lignesGaranties) {
    if (!garantiesParDemande.has(ligne.id_demande)) {
      garantiesParDemande.set(ligne.id_demande, []);
    }
    garantiesParDemande.get(ligne.id_demande).push({
      libelle: ligne.libelle,
      personnalisee: !!ligne.est_personnalisee,
    });
  }

  return demandes.map((d) => ({
    ...d,
    vignette_payee: !!d.vignette_payee,
    garanties: garantiesParDemande.get(d.id_demande) || [],
  }));
}

async function afficherDemandes_en_attente({idClient}){
  const [result] = await pool.query(
    `SELECT id_demande,date_demande,heure_demande,url_cni,url_permis,url_carte_grise,duree_mois,vignette_payee,statut_demande FROM demande_contrat WHERE id_client = ? AND statut_demande = ?`,[idClient,'En attente']
  );

  return _attacherGarantiesEtVignette(result);
};

async function afficherDemandes_valides({idClient}){
  const [result] = await pool.query(
    `SELECT id_demande,date_demande,heure_demande,url_cni,url_permis,url_carte_grise,duree_mois,vignette_payee,statut_demande FROM demande_contrat WHERE id_client = ? AND statut_demande = ?`,[idClient,'valide']
  );

  return _attacherGarantiesEtVignette(result);
};
async function afficherDemandes_rejetes({idClient}){
  // On inclut désormais date_rejet/heure_rejet/motif_rejet : le client doit
  // pouvoir voir POURQUOI sa demande a été rejetée, comme c'est déjà le cas
  // côté employé (afficherToutesDemandes_rejetes ci-dessous).
  const [result] = await pool.query(
    `SELECT id_demande,date_demande,heure_demande,url_cni,url_permis,url_carte_grise,duree_mois,vignette_payee,statut_demande,date_rejet,heure_rejet,motif_rejet FROM demande_contrat WHERE id_client = ? AND statut_demande = ?`,[idClient,'rejete']
  );

  return _attacherGarantiesEtVignette(result);
};
// async function afficherToutesDemandes_en_attente(){
//   const [result] = await pool.query(
//     `SELECT id_demande,date_demande,heure_demande,url_cni,url_permis,url_carte_grise,statut_demande FROM demande_contrat WHERE statut_demande = ?`,['En attente']
//   );

//   return result;
// };

// async function afficherToutesDemandes_valides(){
//   const [result] = await pool.query(
//     `SELECT id_demande,date_demande,heure_demande,url_cni,url_permis,url_carte_grise,statut_demande FROM demande_contrat WHERE statut_demande = ?`,['valide']
//   );

//   return result;
// };
// async function afficherToutesDemandes_rejetes(){
//   const [result] = await pool.query(
//     `SELECT id_demande,date_demande,heure_demande,url_cni,url_permis,url_carte_grise,statut_demande FROM demande_contrat WHERE statut_demande = ?`,['rejete']
//   );

//   return result;
// };

async function afficherToutesDemandes_en_attente(){
  const [result] = await pool.query(
    `SELECT 
      d.id_demande, 
      d.date_demande, 
      d.heure_demande, 
      d.url_cni, 
      d.url_permis, 
      d.url_carte_grise, 
      d.duree_mois,
      d.vignette_payee,
      d.statut_demande, 
      c.nom, 
      c.prenom,
      c.telephone_whatsapp AS tel_whatsapp
     FROM demande_contrat AS d 
     JOIN client AS c ON c.id_utilisateur = d.id_client  -- Correction ici
     WHERE d.statut_demande = ?`, 
    ['En attente']
  );

  return _attacherGarantiesEtVignette(result);
};

async function afficherToutesDemandes_valides(){
  const [result] = await pool.query(
    `SELECT 
      d.id_demande, 
      d.date_demande, 
      d.heure_demande, 
      d.url_cni, 
      d.url_permis, 
      d.url_carte_grise, 
      d.duree_mois,
      d.vignette_payee,
      d.statut_demande, 
      c.nom, 
      c.prenom,
      c.telephone_whatsapp AS tel_whatsapp
     FROM demande_contrat AS d 
     JOIN client AS c ON c.id_utilisateur = d.id_client  -- Correction ici
     WHERE d.statut_demande = ?`, 
    ['valide']
  );

  return _attacherGarantiesEtVignette(result);
};

async function afficherToutesDemandes_rejetes(){
  const [result] = await pool.query(
    `SELECT 
      d.id_demande, 
      d.date_demande, 
      d.heure_demande, 
      d.date_rejet,
      d.heure_rejet,
      d.motif_rejet,
      d.url_cni, 
      d.url_permis, 
      d.url_carte_grise, 
      d.duree_mois,
      d.vignette_payee,
      d.statut_demande, 
      c.nom, 
      c.prenom,
      c.telephone_whatsapp AS tel_whatsapp
     FROM demande_contrat AS d 
     JOIN client AS c ON c.id_utilisateur = d.id_client  -- Correction ici
     WHERE d.statut_demande = ?`, 
    ['rejete']
  );

  return _attacherGarantiesEtVignette(result);
};


async function validerDemande({idDemande, idEmploye}){

  const [result] = await pool.query(
    "UPDATE demande_contrat SET statut_demande = ?, id_employe = ? WHERE id_demande = ?",
    ['valide', idEmploye, idDemande]
  );
  return result;
}


async function rejeterDemande({idDemande, motif, idEmploye}){
  const { date, heure } = getDateHeureCameroun();

  const [result] = await pool.query(
    "UPDATE demande_contrat SET statut_demande = ?, date_rejet = ?, heure_rejet = ?, motif_rejet = ?, id_employe = ? WHERE id_demande = ?",
    ['rejete', date, heure, motif, idEmploye, idDemande]
  );
  return result;
}



async function nb_demandes ({idClient}){
  const [result] = await pool.query(
    `SELECT COUNT(id_demande) AS nb_demandes FROM demande_contrat WHERE id_client = ?`,[idClient]
  )

  return result[0];
}

async function nb_demandes_valides ({idClient}){
  const [result] = await pool.query(
    `SELECT COUNT(id_demande) AS nb_demandes_valides FROM demande_contrat WHERE id_client = ? AND statut_demande = ?`,[idClient,'valide']
  )
  return result[0];
}
async function nb_demandes_rejetes ({idClient}){
  const [result] = await pool.query(
    `SELECT COUNT(id_demande) AS nb_demandes_rejetes FROM demande_contrat WHERE id_client = ? AND statut_demande = ?`,[idClient,'rejete']
  )
  return result[0];
}




module.exports = {
  createDemande,
  afficherDemandes_en_attente,
  afficherDemandes_valides,
  afficherDemandes_rejetes,
  nb_demandes,
  nb_demandes_valides,
  nb_demandes_rejetes,
  afficherToutesDemandes_en_attente,
  afficherToutesDemandes_valides,
  afficherToutesDemandes_rejetes,
  validerDemande,
  rejeterDemande,
};