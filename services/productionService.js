// services/productionService.js
const pool = require('../config/db');

/**
 * Récupère tous les contrats dont la date d'émission (mentionnée sur le contrat)
 * est comprise dans la période donnée.
 * @param {string} dateDebut - format YYYY-MM-DD
 * @param {string} dateFin   - format YYYY-MM-DD
 */
async function getProductionParSemaine(dateDebut, dateFin) {
  const [rows] = await pool.query(
    `SELECT
        CONCAT(c.code_bureau, '/', c.num_police) AS numero_police,
        CONCAT(a.nom, ' ', COALESCE(a.prenom, '')) AS nom_prenom,
        c.date_emission,
        c.date_effet,
        c.date_echeance,
        cr.num_carte_rose,
        att.num_attestation,
        p.tva,
        p.carte_rose AS montant_carte_rose,
        p.prime_totale,
        c.statut_validation
     FROM contrat c
     JOIN vehicule v        ON v.id_vehicule = c.id_vehicule
     JOIN assure a          ON a.id_assure = v.id_assure
     LEFT JOIN carte_rose cr   ON cr.id_document = c.id_carte_rose
     LEFT JOIN attestation att ON att.id_document = c.id_attestation
     LEFT JOIN prime p        ON p.id_document = c.id_document
     WHERE c.date_emission BETWEEN ? AND ?
     ORDER BY c.date_emission ASC`,
    [dateDebut, dateFin]
  );

  return rows;
}

module.exports = { getProductionParSemaine };