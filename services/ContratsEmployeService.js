const pool = require('../config/db');

// ─── Recherche par nom de l'assuré ────────────────────────────────────────────
// Retourne TOUS les contrats liés à un assuré dont le nom ou le prénom
// correspond (même partiellement) au terme recherché.

async function rechercherContratsParNom(nom) {
    const terme = `%${nom}%`;

    const [result] = await pool.query(
        `SELECT
            c.id_document        AS id_document,
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

// ─── Détails complets d'un contrat ────────────────────────────────────────────
// Retourne toutes les informations d'un contrat précis (assuré, véhicule,
// garanties, prime...) à partir de son id_document, pour l'affichage dans
// la modal de détails côté employé.

async function obtenirDetailsContrat(idDocument) {
    const [contratRows] = await pool.query(
        `SELECT
            c.id_document         AS id_document,
            c.code_bureau         AS bureau,
            c.adresse_bureau      AS adresse_bureau,
            c.num_police          AS num_police,
            c.date_emission       AS date_emission,
            c.date_effet          AS date_effet,
            c.date_echeance       AS date_echeance,
            c.duree               AS duree,
            c.type_contrat        AS type_contrat,
            c.statut_validation   AS statut_validation,
            CAST(CASE
                WHEN CURDATE() < c.date_effet THEN 'en_attente_effet'
                WHEN CURDATE() >= c.date_echeance THEN 'expire'
                ELSE 'en_cours'
            END AS CHAR(20)) AS statut_temporel,
            a.nom                 AS assure_nom,
            a.prenom              AS assure_prenom,
            a.telephone           AS assure_telephone,
            a.profession           AS assure_profession,
            a.activite            AS assure_activite,
            a.adresse             AS assure_adresse,
            v.categorie           AS vehicule_categorie,
            v.marque              AS marque,
            v.modele              AS modele,
            v.immatriculation     AS immatriculation,
            v.numero_chassis      AS numero_chassis,
            v.nom_conducteur      AS nom_conducteur,
            v.prenom_conducteur   AS prenom_conducteur,
            p.prime_nette         AS prime_nette,
            p.dta                 AS dta,
            p.prime_totale        AS prime_totale
         FROM contrat c
         JOIN vehicule v ON v.id_vehicule = c.id_vehicule
         JOIN assure a   ON a.id_assure = v.id_assure
         LEFT JOIN prime p ON p.id_document = c.id_document
         WHERE c.id_document = ?`,
        [idDocument]
    );

    if (contratRows.length === 0) {
        return null;
    }

    const [garanties] = await pool.query(
        `SELECT
            libelle          AS libelle,
            capital           AS capital,
            franchise_limite  AS franchise_limite,
            prime_periode     AS prime_periode
         FROM garantie
         WHERE id_document = ?
         ORDER BY id_garantie ASC`,
        [idDocument]
    );

    return {
        ...contratRows[0],
        garanties,
    };
}

module.exports = {
    rechercherContratsParNom,
    obtenirDetailsContrat,
};