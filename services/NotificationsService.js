// services/notificationsService.js
const pool = require('../config/db');

// ─── Contrats à surveiller ────────────────────────────────────────────────────
//
// Logique : pour chaque véhicule, on prend son contrat le plus récent (le plus
// grand date_echeance). On le retient si :
//   - il expire dans <= 30 jours (ou est déjà expiré)
//   - ET aucun autre contrat pour ce véhicule n'a un date_effet postérieur à
//     son date_echeance (= pas encore renouvelé)
//
// Comme le contrat le plus récent est déjà celui de plus grande date_echeance,
// la clause NOT EXISTS est une double sécurité : si un renouvellement existe,
// c'est en principe LUI qui devient le "plus récent", et son propre
// date_echeance (généralement ~1 an plus tard) ne déclenche alors plus
// l'alerte. On garde quand même la vérification explicite au cas où les dates
// extraites par l'IA seraient incohérentes.

async function getAlertesContrats() {
  const [rows] = await pool.query(`
    SELECT
      c.id_document,
      c.code_bureau,
      c.num_police,
      c.date_echeance,
      DATEDIFF(c.date_echeance, CURDATE()) AS jours_restants,
      v.id_vehicule,
      v.immatriculation,
      v.marque,
      v.modele,
      a.nom    AS nom_assure,
      a.prenom AS prenom_assure
    FROM contrat c
    INNER JOIN vehicule v ON v.id_vehicule = c.id_vehicule
    LEFT JOIN assure a ON a.id_assure = v.id_assure
    WHERE c.date_echeance = (
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
    ORDER BY jours_restants ASC
  `);

  return rows;
}

module.exports = { getAlertesContrats };