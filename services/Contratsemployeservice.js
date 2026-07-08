const pool = require('../config/db');

// ─── Recherche par nom de l'assuré ────────────────────────────────────────────
// Retourne TOUS les contrats liés à un assuré dont le nom ou le prénom
// correspond (même partiellement) au terme recherché.

async function rechercherContratsParNom(nom) {
    const terme = `%${nom}%`;

    const [result] = await pool.query(
        `SELECT
            c.code_bureau        AS bureau,
            c.adresse_bureau     AS adresse_bureau,
            c.num_police         AS num_police,
            c.date_emission      AS date_emission,
            c.date_effet         AS date_effet,
            c.date_echeance      AS date_echeance,
            c.type_contrat       AS type_contrat,
            c.statut_validation  AS statut_validation,
            CAST(CASE
                WHEN CURDATE() < c.date_effet THEN 'en_attente_effet'
                WHEN CURDATE() >= c.date_echeance THEN 'expire'
                ELSE 'en_cours'
            END AS CHAR(20)) AS statut_temporel,
            a.nom                AS assure_nom,
            a.prenom             AS assure_prenom,
            v.marque             AS marque,
            v.modele             AS modele,
            v.immatriculation    AS immatriculation,
            p.prime_nette        AS prime_nette,
            p.prime_totale       AS prime_totale
         FROM contrat c
         JOIN vehicule v ON v.id_vehicule = c.id_vehicule
         JOIN assure a   ON a.id_assure = v.id_assure
         LEFT JOIN prime p ON p.id_document = c.id_document
         WHERE CONCAT(a.nom, ' ', COALESCE(a.prenom, '')) LIKE ?
            OR a.nom LIKE ?
            OR a.prenom LIKE ?
         ORDER BY c.date_emission DESC`,
        [terme, terme, terme]
    );

    return result;
}

module.exports = {
    rechercherContratsParNom,
};