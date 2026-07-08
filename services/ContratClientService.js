// services/contratClientService.js
const pool = require('../config/db');

/**
 * Récupère tous les contrats appartenant au client connecté.
 * L'attribution se fait par association du nom ET du prénom du client
 * (ex: nom = "Martin", prénom = "Matin" => "Martin Matin"), comparé
 * à la colonne unique assure.nom qui contient le nom complet de l'assuré.
 * Le statut (en cours / expiré / en attente d'effet) est calculé en SQL
 * par comparaison avec la date du jour.
 */
async function getContratsClient(nomClient, prenomClient) {
  // On assemble "Nom Prénom" en un seul terme, en gérant les espaces multiples
  // et en ignorant un prénom vide/absent.
  const nomComplet = `${nomClient || ''} ${prenomClient || ''}`
    .replace(/\s+/g, ' ')
    .trim();

  const [rows] = await pool.query(
    `SELECT
        c.id_document,
        c.code_bureau,
        c.num_police,
        c.date_emission,
        c.date_effet,
        c.date_echeance,
        cr.num_carte_rose,
        v.marque,
        v.modele,
        v.immatriculation,
        p.accessoires,
        p.prime_totale,
        CASE
          WHEN CURDATE() < c.date_effet THEN 'en_attente_effet'
          WHEN CURDATE() > c.date_echeance THEN 'expire'
          ELSE 'en_cours'
        END AS statut_calcule
     FROM contrat c
     JOIN vehicule v        ON v.id_vehicule = c.id_vehicule
     JOIN assure a           ON a.id_assure = v.id_assure
     LEFT JOIN carte_rose cr ON cr.id_document = c.id_carte_rose
     LEFT JOIN prime p       ON p.id_document = c.id_document
     WHERE TRIM(LOWER(a.nom)) = TRIM(LOWER(?))
     ORDER BY c.date_effet DESC`,
    [nomComplet]
  );

  return rows;
}

/**
 * Récupère les contrats du client connecté qui nécessitent une notification.
 *
 * Même logique que notificationsService.getAlertesContrats() (pour chaque
 * véhicule, on retient son contrat le plus récent s'il expire dans <= 30
 * jours, ou est déjà expiré, et qu'aucun renouvellement n'a encore été
 * enregistré) mais restreinte aux seuls véhicules dont l'assuré correspond
 * à CE client (même filtre nom+prénom que getContratsClient), pour qu'un
 * client ne voie jamais les alertes des contrats des autres clients.
 */
async function getAlertesContratsClient(nomClient, prenomClient) {
  const nomComplet = `${nomClient || ''} ${prenomClient || ''}`
    .replace(/\s+/g, ' ')
    .trim();

  const [rows] = await pool.query(
    `SELECT
        c.id_document,
        c.code_bureau,
        c.num_police,
        c.date_echeance,
        DATEDIFF(c.date_echeance, CURDATE()) AS jours_restants,
        v.id_vehicule,
        v.immatriculation,
        v.marque,
        v.modele
     FROM contrat c
     INNER JOIN vehicule v ON v.id_vehicule = c.id_vehicule
     INNER JOIN assure a   ON a.id_assure = v.id_assure
     WHERE TRIM(LOWER(a.nom)) = TRIM(LOWER(?))
       AND c.date_echeance = (
         SELECT MAX(c2.date_echeance)
         FROM contrat c2
         WHERE c2.id_vehicule = c.id_vehicule
       )
       AND DATEDIFF(c.date_echeance, CURDATE()) <= 30
       AND NOT EXISTS (
         SELECT 1 FROM contrat c3
         WHERE c3.id_vehicule = c.id_vehicule
           AND c3.date_effet > c.date_echeance
       )
     ORDER BY jours_restants ASC`,
    [nomComplet]
  );

  return rows;
}

module.exports = { getContratsClient, getAlertesContratsClient };