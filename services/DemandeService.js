const pool = require('../config/db');

async function createDemande({ idClient, urlCni, urlPermis, urlCarteGrise, dureeMois }) {
  const [result] = await pool.query(
    `INSERT INTO demande_contrat (date_demande, heure_demande, statut_demande, url_cni, url_permis, url_carte_grise, duree_mois, id_client)
     VALUES (CURDATE(), CURTIME(), 'En attente', ?, ?, ?, ?, ?)`,
    [urlCni, urlPermis, urlCarteGrise, dureeMois, idClient]
  );

  return result.insertId;
}

async function afficherDemandes_en_attente({idClient}){
  const [result] = await pool.query(
    `SELECT date_demande,heure_demande,url_cni,url_permis,url_carte_grise,duree_mois,statut_demande FROM demande_contrat WHERE id_client = ? AND statut_demande = ?`,[idClient,'En attente']
  );

  return result;
};

async function afficherDemandes_valides({idClient}){
  const [result] = await pool.query(
    `SELECT date_demande,heure_demande,url_cni,url_permis,url_carte_grise,duree_mois,statut_demande FROM demande_contrat WHERE id_client = ? AND statut_demande = ?`,[idClient,'valide']
  );

  return result;
};
async function afficherDemandes_rejetes({idClient}){
  // On inclut désormais date_rejet/heure_rejet/motif_rejet : le client doit
  // pouvoir voir POURQUOI sa demande a été rejetée, comme c'est déjà le cas
  // côté employé (afficherToutesDemandes_rejetes ci-dessous).
  const [result] = await pool.query(
    `SELECT date_demande,heure_demande,url_cni,url_permis,url_carte_grise,duree_mois,statut_demande,date_rejet,heure_rejet,motif_rejet FROM demande_contrat WHERE id_client = ? AND statut_demande = ?`,[idClient,'rejete']
  );

  return result;
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
      d.statut_demande, 
      c.nom, 
      c.prenom,
      c.telephone_whatsapp AS tel_whatsapp
     FROM demande_contrat AS d 
     JOIN client AS c ON c.id_utilisateur = d.id_client  -- Correction ici
     WHERE d.statut_demande = ?`, 
    ['En attente']
  );

  return result;
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
      d.statut_demande, 
      c.nom, 
      c.prenom,
      c.telephone_whatsapp AS tel_whatsapp
     FROM demande_contrat AS d 
     JOIN client AS c ON c.id_utilisateur = d.id_client  -- Correction ici
     WHERE d.statut_demande = ?`, 
    ['valide']
  );

  return result;
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
      d.statut_demande, 
      c.nom, 
      c.prenom,
      c.telephone_whatsapp AS tel_whatsapp
     FROM demande_contrat AS d 
     JOIN client AS c ON c.id_utilisateur = d.id_client  -- Correction ici
     WHERE d.statut_demande = ?`, 
    ['rejete']
  );

  return result;
};


async function validerDemande({idDemande}){

  const [result] = await pool.query(
    "UPDATE demande_contrat SET statut_demande = ? WHERE id_demande = ?",
    ['valide', idDemande]
  );
  return result;
}


async function rejeterDemande({idDemande, motif}){


  const [result] = await pool.query(
    "UPDATE demande_contrat SET statut_demande = ?, date_rejet = CURDATE(), heure_rejet = CURTIME(), motif_rejet = ? WHERE id_demande = ?",
    ['rejete', motif, idDemande]
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