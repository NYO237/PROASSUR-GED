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

// ─── Demandes de contrat non traitées ─────────────────────────────────────────
//
// Logique : une demande est considérée "non traitée" tant que son
// statut_demande n'est ni 'valide' ni 'rejete' (donc typiquement 'En attente').
// On alerte si elle est en attente depuis plus de SEUIL_ALERTE_MINUTES (2h).
//
// Contrainte horaire : ces alertes ne doivent apparaître qu'en journée. Entre
// HEURE_FIN_JOURNEE (20h) et HEURE_DEBUT_JOURNEE (6h), on ne génère aucune
// alerte de demande — même si des demandes dépassent le seuil de 2h, on
// considère qu'il n'y a personne pour les traiter la nuit. Dès 6h, les
// demandes toujours en attente réapparaissent avec le retard réellement
// accumulé (qui peut donc dépasser largement 2h après une nuit entière).

const HEURE_DEBUT_JOURNEE = 6;    // 06h00 : les alertes de demandes reprennent
const HEURE_FIN_JOURNEE = 20;     // 20h00 : les alertes de demandes s'arrêtent
const SEUIL_ALERTE_MINUTES = 120; // 2h sans traitement avant alerte

function estDansPlageHoraireDeNotification(date = new Date()) {
  const heure = date.getHours();
  return heure >= HEURE_DEBUT_JOURNEE && heure < HEURE_FIN_JOURNEE;
}

async function getAlertesDemandesNonTraitees() {
  // Rien à faire la nuit (20h-6h) : on court-circuite avant même la requête SQL.
  if (!estDansPlageHoraireDeNotification()) {
    return [];
  }

  const [rows] = await pool.query(
    `
    SELECT
      d.id_demande,
      d.date_demande,
      d.heure_demande,
      d.statut_demande,
      TIMESTAMPDIFF(MINUTE, TIMESTAMP(d.date_demande, d.heure_demande), NOW()) AS minutes_ecoulees,
      c.id_utilisateur     AS id_client,
      c.nom                AS nom_client,
      c.prenom             AS prenom_client,
      c.telephone_whatsapp AS telephone_client
    FROM demande_contrat d
    INNER JOIN client c ON c.id_utilisateur = d.id_client
    WHERE d.statut_demande NOT IN ('valide', 'rejete')
      AND TIMESTAMP(d.date_demande, d.heure_demande) <= DATE_SUB(NOW(), INTERVAL ? MINUTE)
    ORDER BY minutes_ecoulees DESC
    `,
    [SEUIL_ALERTE_MINUTES]
  );

  return rows;
}

module.exports = {
  getAlertesContrats,
  getAlertesDemandesNonTraitees,
  estDansPlageHoraireDeNotification,
};