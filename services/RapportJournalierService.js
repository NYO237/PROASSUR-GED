// services/rapportJournalierService.js
const pool = require('../config/db');

// ── Récupère un rapport par date ──────────────────────────────────────────────
async function getRapportParDate(dateRapport) {
  const [rows] = await pool.query(
    `SELECT * FROM rapport_journalier WHERE date_rapport = ?`,
    [dateRapport]
  );
  return rows[0] || null;
}

// ── Récupère le solde final du dernier rapport avant la date donnée ───────────
async function getSoldeFinalVeille(dateRapport) {
  const [rows] = await pool.query(
    `SELECT date_rapport, solde_final_especes, solde_final_cheques
     FROM rapport_journalier
     WHERE date_rapport < ?
     ORDER BY date_rapport DESC
     LIMIT 1`,
    [dateRapport]
  );
  return rows[0] || null;
}

// ── Sauvegarde ou met à jour un rapport (INSERT ... ON DUPLICATE KEY UPDATE) ──
async function sauvegarderRapport(data, idEmploye) {
  const {
    date_rapport,
    sur_emission_especes      = 0,
    sur_emission_electronique = 0,
    pool_tpv                  = 0,
    hors_orass                 = 0,
    courtage                   = 0,
    depots_clients              = 0,
    rembst_clients_avenant       = 0,
    total_versement_banque    = 0,
    commissions_payees        = 0,
    numero_bordereau          = null,
    solde_initial_especes     = 0,
    solde_initial_cheques     = 0,
    autres_depenses           = 0,
    versement_banque          = 0,
    versement_compta          = 0,
    observations              = null,
  } = data;

  // (5) TOTAUX espèces = toutes les lignes d'encaissement en espèces
  const totalEspeces = Number(sur_emission_especes) + Number(pool_tpv)
    + Number(hors_orass) + Number(courtage) + Number(depots_clients);

  // (5)-(6) ENCAISSEMENTS NETS espèces = TOTAUX - REMBST CLIENTS/AVENANT
  const enc_nets_especes = totalEspeces - Number(rembst_clients_avenant);

  // Formule du solde final espèces :
  // (Encaissements nets + Solde initial) - (Commissions + Autres dépenses + Versements)
  const solde_final_especes =
    (enc_nets_especes + Number(solde_initial_especes))
    - (Number(commissions_payees) + Number(autres_depenses)
       + Number(versement_banque) + Number(versement_compta));

  // Solde final chèques/électronique (simplifié — pas de ligne chèques sur les nouveaux postes)
  const solde_final_cheques =
    Number(sur_emission_electronique) + Number(solde_initial_cheques);

  await pool.query(
    `INSERT INTO rapport_journalier
       (date_rapport,
        sur_emission_especes, sur_emission_electronique,
        pool_tpv, hors_orass, courtage, depots_clients, rembst_clients_avenant,
        total_versement_banque,
        commissions_payees, numero_bordereau,
        solde_initial_especes, solde_initial_cheques,
        autres_depenses, versement_banque, versement_compta,
        solde_final_especes, solde_final_cheques,
        observations, id_employe)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       sur_emission_especes      = VALUES(sur_emission_especes),
       sur_emission_electronique = VALUES(sur_emission_electronique),
       pool_tpv                  = VALUES(pool_tpv),
       hors_orass                = VALUES(hors_orass),
       courtage                  = VALUES(courtage),
       depots_clients            = VALUES(depots_clients),
       rembst_clients_avenant    = VALUES(rembst_clients_avenant),
       total_versement_banque    = VALUES(total_versement_banque),
       commissions_payees        = VALUES(commissions_payees),
       numero_bordereau          = VALUES(numero_bordereau),
       solde_initial_especes     = VALUES(solde_initial_especes),
       solde_initial_cheques     = VALUES(solde_initial_cheques),
       solde_final_especes       = VALUES(solde_final_especes),
       solde_final_cheques       = VALUES(solde_final_cheques),
       observations              = VALUES(observations),
       updated_at                = CURRENT_TIMESTAMP`,
    [
      date_rapport,
      sur_emission_especes, sur_emission_electronique,
      pool_tpv, hors_orass, courtage, depots_clients, rembst_clients_avenant,
      total_versement_banque,
      commissions_payees, numero_bordereau,
      solde_initial_especes, solde_initial_cheques,
      autres_depenses, versement_banque, versement_compta,
      solde_final_especes, solde_final_cheques,
      observations, idEmploye,
    ]
  );

  const [[row]] = await pool.query(
    `SELECT id_rapport FROM rapport_journalier WHERE date_rapport = ?`,
    [date_rapport]
  );

  return { id_rapport: row.id_rapport, solde_final_especes, solde_final_cheques };
}

// ── Mise à jour des lignes saisies manuellement ───────────────────────────────
async function mettreAJourLigneManuelle(dateRapport, champs, idEmploye) {
  const rapport = await getRapportParDate(dateRapport);
  if (!rapport) throw new Error('Rapport introuvable pour cette date.');

  // Fusion des données existantes avec les nouvelles valeurs
  const merged = { ...rapport, ...champs };

  // (5) TOTAUX espèces, (5)-(6) ENCAISSEMENTS NETS espèces — même formule que sauvegarderRapport
  const totalEspeces = Number(merged.sur_emission_especes) + Number(merged.pool_tpv || 0)
    + Number(merged.hors_orass || 0) + Number(merged.courtage || 0) + Number(merged.depots_clients || 0);
  const enc_nets_especes = totalEspeces - Number(merged.rembst_clients_avenant || 0);

  // Recalcul du solde final
  const solde_final_especes =
    (enc_nets_especes + Number(merged.solde_initial_especes))
    - (Number(merged.commissions_payees) + Number(merged.autres_depenses)
       + Number(merged.versement_banque) + Number(merged.versement_compta));

  const solde_final_cheques =
    Number(merged.sur_emission_electronique) + Number(merged.solde_initial_cheques);

  // Champs autorisés à la modification manuelle
  const champsAutorisés = [
    'sur_emission_especes', 'sur_emission_electronique',
    'pool_tpv', 'hors_orass', 'courtage', 'depots_clients', 'rembst_clients_avenant',
    'commissions_payees',
    'autres_depenses', 'versement_banque', 'versement_compta',
    'solde_initial_especes', 'solde_initial_cheques', 'observations',
  ];

  const setClauses = [];
  const values     = [];

  for (const key of champsAutorisés) {
    if (champs[key] !== undefined) {
      setClauses.push(`${key} = ?`);
      values.push(champs[key]);
    }
  }

  if (setClauses.length === 0) throw new Error('Aucun champ valide à mettre à jour.');

  setClauses.push('solde_final_especes = ?', 'solde_final_cheques = ?', 'updated_at = CURRENT_TIMESTAMP');
  values.push(solde_final_especes, solde_final_cheques, dateRapport);

  await pool.query(
    `UPDATE rapport_journalier SET ${setClauses.join(', ')} WHERE date_rapport = ?`,
    values
  );

  return { solde_final_especes, solde_final_cheques };
}

module.exports = {
  getRapportParDate,
  getSoldeFinalVeille,
  sauvegarderRapport,
  mettreAJourLigneManuelle,
};