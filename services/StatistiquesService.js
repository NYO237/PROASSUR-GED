// services/statistiquesService.js
const pool = require('../config/db');

const PERIODES_VALIDES = ['jour', 'semaine', 'mois', 'tout'];
const NOMS_MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function normaliserPeriode(periode) {
  return PERIODES_VALIDES.includes(periode) ? periode : 'mois';
}

/**
 * Construit les clauses SQL "période actuelle" / "période précédente équivalente"
 * pour une colonne date donnée (ex: 'c.date_emission', 'd.date_demande').
 * NB : pour une colonne DATETIME (ex: document.date_importation), il faut
 * l'envelopper avec DATE(...) avant de l'utiliser ici, sinon la comparaison
 * d'égalité du cas "jour" ne matchera jamais (l'heure n'est pas minuit).
 */
function clausesPeriode(colonne, periode) {
  switch (periode) {
    case 'jour':
      return {
        actuel: `${colonne} = CURDATE()`,
        precedent: `${colonne} = CURDATE() - INTERVAL 1 DAY`,
      };
    case 'semaine':
      return {
        actuel: `YEARWEEK(${colonne}, 3) = YEARWEEK(CURDATE(), 3)`,
        precedent: `YEARWEEK(${colonne}, 3) = YEARWEEK(CURDATE() - INTERVAL 1 WEEK, 3)`,
      };
    case 'tout':
      // Pas de "période précédente" qui ait un sens pour le cumul depuis toujours
      return { actuel: '1=1', precedent: '1=0' };
    case 'mois':
    default:
      return {
        actuel: `MONTH(${colonne}) = MONTH(CURDATE()) AND YEAR(${colonne}) = YEAR(CURDATE())`,
        precedent: `MONTH(${colonne}) = MONTH(CURDATE() - INTERVAL 1 MONTH) AND YEAR(${colonne}) = YEAR(CURDATE() - INTERVAL 1 MONTH)`,
      };
  }
}

function calculEvolution(actuel, precedent) {
  const a = Number(actuel) || 0;
  const p = Number(precedent) || 0;
  if (p <= 0) return null;
  return ((a - p) / p) * 100;
}

/**
 * Cartes de synthèse : chiffre d'affaires, véhicules assurés, assurés,
 * + détail contrats (total / en cours / en attente d'effet / expirés)
 * + détail demandes (total / en attente / validées / rejetées / taux d'acceptation)
 * + répartition des véhicules assurés par catégorie (bonus), pour la période demandée.
 *
 * NB statuts "demande" : on classe par correspondance approximative (LIKE) plutôt
 * que par égalité stricte, car la collation utf8mb4_0900_ai_ci est déjà insensible
 * à la casse/aux accents, mais on ne connait pas la valeur exacte stockée pour une
 * demande validée (seuls 'En attente' et 'rejete' sont visibles dans le dump actuel).
 * Tout ce qui ne contient ni "attente" ni "rejet" est comptée comme "validée".
 *
 * NB statuts "contrat" : en cours / en attente d'effet / expiré sont calculés à
 * partir des dates (date_effet, date_echeance) comparées à CURDATE(), et non à
 * partir de `statut_validation` (qui semble représenter autre chose : brouillon
 * vs validé administrativement). Dis-moi si tu veux plutôt baser ça sur
 * `statut_validation`, j'ajusterai la requête.
 */
async function getCartesSynthese(periodeBrute) {
  const periode = normaliserPeriode(periodeBrute);
  const clContrat = clausesPeriode('c.date_emission', periode);
  const clDemande = clausesPeriode('d.date_demande', periode);
  const clRapport = clausesPeriode('r.date_rapport', periode);

  const [lignesContrats] = await pool.query(`
    SELECT
      COUNT(DISTINCT CASE WHEN ${clContrat.actuel} THEN c.id_document END) AS total_actuel,
      COUNT(DISTINCT CASE WHEN ${clContrat.actuel} AND c.date_effet > CURDATE() THEN c.id_document END) AS attente_effet_actuel,
      COUNT(DISTINCT CASE WHEN ${clContrat.actuel} AND c.date_effet <= CURDATE() AND c.date_echeance >= CURDATE() THEN c.id_document END) AS en_cours_actuel,
      COUNT(DISTINCT CASE WHEN ${clContrat.actuel} AND c.date_echeance < CURDATE() THEN c.id_document END) AS expires_actuel,
      COUNT(DISTINCT CASE WHEN ${clContrat.precedent} THEN c.id_document END) AS total_precedent,
      COUNT(DISTINCT CASE WHEN ${clContrat.actuel} THEN c.id_vehicule END) AS vehicules_actuel,
      COUNT(DISTINCT CASE WHEN ${clContrat.actuel} THEN v.id_assure END) AS assures_actuel
    FROM contrat c
    LEFT JOIN vehicule v ON v.id_vehicule = c.id_vehicule
  `);
  const s = lignesContrats[0];

  // ── CA réel = total des encaissements du rapport journalier (PDF ORASS scanné),
  //    et non la prime émise (contrat/prime), qui ne reflète pas l'argent réellement encaissé.
  const [lignesCA] = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN ${clRapport.actuel} THEN r.sur_emission_especes END), 0) AS ca_actuel,
      COALESCE(SUM(CASE WHEN ${clRapport.precedent} THEN r.sur_emission_especes END), 0) AS ca_precedent
    FROM rapport_journalier r
  `);
  const caRow = lignesCA[0];

  const [lignesDemandes] = await pool.query(`
    SELECT
      COUNT(CASE WHEN ${clDemande.actuel} THEN 1 END) AS total_actuel,
      COUNT(CASE WHEN ${clDemande.actuel} AND d.statut_demande LIKE '%attente%' THEN 1 END) AS attente_actuel,
      COUNT(CASE WHEN ${clDemande.actuel} AND d.statut_demande LIKE '%rejet%' THEN 1 END) AS rejetees_actuel,
      COUNT(CASE WHEN ${clDemande.actuel} AND d.statut_demande NOT LIKE '%attente%' AND d.statut_demande NOT LIKE '%rejet%' THEN 1 END) AS validees_actuel,
      COUNT(CASE WHEN ${clDemande.precedent} THEN 1 END) AS total_precedent
    FROM demande_contrat d
  `);
  const dRow = lignesDemandes[0];

  const [lignesCategories] = await pool.query(`
    SELECT
      COALESCE(NULLIF(TRIM(v.categorie), ''), 'Non renseignée') AS categorie,
      COUNT(DISTINCT v.id_vehicule) AS nb
    FROM contrat c
    INNER JOIN vehicule v ON v.id_vehicule = c.id_vehicule
    WHERE ${clContrat.actuel}
    GROUP BY categorie
    ORDER BY nb DESC
    LIMIT 6
  `);

  const validees = Number(dRow.validees_actuel) || 0;
  const rejetees = Number(dRow.rejetees_actuel) || 0;
  const traitees = validees + rejetees;
  const tauxAcceptation = traitees > 0 ? (validees / traitees) * 100 : null;

  return {
    periode,
    ca: Number(caRow.ca_actuel),
    evolution_ca: calculEvolution(caRow.ca_actuel, caRow.ca_precedent),
    vehicules_assures: s.vehicules_actuel,
    assures: s.assures_actuel,
    demandes: {
      total: dRow.total_actuel,
      en_attente: dRow.attente_actuel,
      validees,
      rejetees,
      evolution: calculEvolution(dRow.total_actuel, dRow.total_precedent),
      taux_acceptation: tauxAcceptation,
    },
    contrats: {
      total: s.total_actuel,
      en_cours: s.en_cours_actuel,
      en_attente_effet: s.attente_effet_actuel,
      expires: s.expires_actuel,
      evolution: calculEvolution(s.total_actuel, s.total_precedent),
    },
    repartition_vehicules_categorie: lignesCategories.map((r) => ({ categorie: r.categorie, nb: r.nb })),
  };
}

/**
 * Top 5 des employés les plus actifs sur la période choisie, avec le nombre
 * de contrats scannés (documents importés puis rattachés à un contrat) et le
 * nombre de demandes traitées (validées ou rejetées, hors "en attente").
 *
 * ⚠️ Important : ce classement dépend de `demande_contrat.id_employe` étant
 * renseigné au moment où la demande est validée/rejetée. Dans le jeu de
 * données actuel, ce champ reste NULL même pour des demandes déjà rejetées :
 * il faudra que le contrôleur qui traite les demandes fasse bien
 * `UPDATE demande_contrat SET statut_demande = ?, id_employe = ? WHERE id_demande = ?`
 * avec l'utilisateur connecté, sinon "demandes traitées" restera à 0 pour tout le monde.
 */
async function getTopEmployes(periodeBrute) {
  const periode = normaliserPeriode(periodeBrute);
  const clDocument = clausesPeriode('DATE(doc.date_importation)', periode);
  const clDemande = clausesPeriode('d.date_demande', periode);

  const [rows] = await pool.query(`
    SELECT
      e.id_utilisateur,
      e.nom,
      e.prenom,
      COALESCE(cs.nb, 0) AS contrats_scannes,
      COALESCE(dt.nb, 0) AS demandes_traitees
    FROM employe e
    LEFT JOIN (
      SELECT doc.id_employe AS id_employe, COUNT(DISTINCT c.id_document) AS nb
      FROM contrat c
      INNER JOIN document doc ON doc.id_document = c.id_document
      WHERE ${clDocument.actuel}
      GROUP BY doc.id_employe
    ) cs ON cs.id_employe = e.id_utilisateur
    LEFT JOIN (
      SELECT d.id_employe AS id_employe, COUNT(*) AS nb
      FROM demande_contrat d
      WHERE d.id_employe IS NOT NULL
        AND d.statut_demande NOT LIKE '%attente%'
        AND ${clDemande.actuel}
      GROUP BY d.id_employe
    ) dt ON dt.id_employe = e.id_utilisateur
    HAVING (contrats_scannes + demandes_traitees) > 0
    ORDER BY (contrats_scannes + demandes_traitees) DESC, contrats_scannes DESC, e.nom ASC
    LIMIT 5
  `);

  return {
    periode,
    employes: rows.map((r, index) => ({
      rang: index + 1,
      id_utilisateur: r.id_utilisateur,
      nom: r.nom,
      prenom: r.prenom,
      contrats_scannes: r.contrats_scannes,
      demandes_traitees: r.demandes_traitees,
      score: Number(r.contrats_scannes) + Number(r.demandes_traitees),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Génération des "buckets" (créneaux temporels) pour les graphiques   */
/* ------------------------------------------------------------------ */

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Calcule l'année ISO et le numéro de semaine ISO d'une date (aligné sur MySQL YEARWEEK(date, 3))
function semaineIsoDe(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const jourNum = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - jourNum + 3); // jeudi de cette semaine
  const premierJeudi = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const premierJourNum = (premierJeudi.getUTCDay() + 6) % 7;
  premierJeudi.setUTCDate(premierJeudi.getUTCDate() - premierJourNum + 3);
  const semaine = 1 + Math.round((d - premierJeudi) / (7 * 24 * 3600 * 1000));
  return { anneeIso: d.getUTCFullYear(), semaineIso: semaine };
}

function lundiDe(date) {
  const d = new Date(date);
  const jour = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - jour);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Génère la liste ordonnée de créneaux (clé + label) pour jour/semaine/mois.
 * La clé doit correspondre exactement à ce que retournent les requêtes SQL
 * (DATE(), YEARWEEK(..., 3), DATE_FORMAT(..., '%Y-%m')).
 */
function genererBuckets(periode) {
  const aujourdhui = new Date();

  if (periode === 'jour') {
    const buckets = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(aujourdhui);
      d.setDate(d.getDate() - i);
      const cle = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      buckets.push({ cle, label: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}` });
    }
    return buckets;
  }

  if (periode === 'semaine') {
    const buckets = [];
    const lundiActuel = lundiDe(aujourdhui);
    for (let i = 11; i >= 0; i--) {
      const lundi = new Date(lundiActuel);
      lundi.setDate(lundi.getDate() - i * 7);
      const { anneeIso, semaineIso } = semaineIsoDe(lundi);
      const cle = String(anneeIso * 100 + semaineIso);
      buckets.push({ cle, label: `S${semaineIso} (${pad2(lundi.getDate())}/${pad2(lundi.getMonth() + 1)})` });
    }
    return buckets;
  }

  // mois : 12 derniers mois
  const buckets = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - i, 1);
    const cle = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    buckets.push({ cle, label: `${NOMS_MOIS[d.getMonth()]} ${d.getFullYear()}` });
  }
  return buckets;
}

function expressionCle(colonne, periode) {
  if (periode === 'jour') return `DATE(${colonne})`;
  if (periode === 'semaine') return `YEARWEEK(${colonne}, 3)`;
  if (periode === 'tout') return `YEAR(${colonne})`;
  return `DATE_FORMAT(${colonne}, '%Y-%m')`; // mois
}

function clauseFenetre(colonne, periode) {
  if (periode === 'jour') return `WHERE ${colonne} >= CURDATE() - INTERVAL 14 DAY`;
  if (periode === 'semaine') return `WHERE ${colonne} >= CURDATE() - INTERVAL 12 WEEK`;
  if (periode === 'mois') return `WHERE ${colonne} >= CURDATE() - INTERVAL 12 MONTH`;
  return `WHERE ${colonne} IS NOT NULL`; // tout
}

async function recupererContratsParCle(periode) {
  const cle = expressionCle('c.date_emission', periode);
  const fenetre = clauseFenetre('c.date_emission', periode);

  const [rows] = await pool.query(`
    SELECT ${cle} AS cle, COUNT(DISTINCT c.id_document) AS nb
    FROM contrat c
    ${fenetre}
    GROUP BY cle
  `);

  const map = new Map();
  rows.forEach((r) => map.set(String(r.cle), { nb: r.nb }));
  return map;
}

// ── CA réel par créneau, basé sur les encaissements du rapport journalier ────
async function recupererCAParCle(periode) {
  const cle = expressionCle('r.date_rapport', periode);
  const fenetre = clauseFenetre('r.date_rapport', periode);

  const [rows] = await pool.query(`
    SELECT ${cle} AS cle, COALESCE(SUM(r.sur_emission_especes), 0) AS ca
    FROM rapport_journalier r
    ${fenetre}
    GROUP BY cle
  `);

  const map = new Map();
  rows.forEach((r) => map.set(String(r.cle), Number(r.ca)));
  return map;
}

async function recupererDemandesParCle(periode) {
  const cle = expressionCle('d.date_demande', periode);
  const fenetre = clauseFenetre('d.date_demande', periode);

  const [rows] = await pool.query(`
    SELECT ${cle} AS cle, COUNT(*) AS nb
    FROM demande_contrat d
    ${fenetre}
    GROUP BY cle
  `);

  const map = new Map();
  rows.forEach((r) => map.set(String(r.cle), r.nb));
  return map;
}

// ── Répartition par statut (en attente / validées / rejetées), par créneau ──
async function recupererDemandesStatutParCle(periode) {
  const cle = expressionCle('d.date_demande', periode);
  const fenetre = clauseFenetre('d.date_demande', periode);

  const [rows] = await pool.query(`
    SELECT
      ${cle} AS cle,
      COUNT(CASE WHEN d.statut_demande LIKE '%attente%' THEN 1 END) AS attente,
      COUNT(CASE WHEN d.statut_demande LIKE '%rejet%' THEN 1 END) AS rejetees,
      COUNT(CASE WHEN d.statut_demande NOT LIKE '%attente%' AND d.statut_demande NOT LIKE '%rejet%' THEN 1 END) AS validees
    FROM demande_contrat d
    ${fenetre}
    GROUP BY cle
  `);

  const map = new Map();
  rows.forEach((r) => map.set(String(r.cle), { attente: r.attente, rejetees: r.rejetees, validees: r.validees }));
  return map;
}

/**
 * Séries temporelles (contrats, CA, demandes) pour les graphiques,
 * avec un pas adapté à la période choisie :
 *  - jour    -> 14 derniers jours
 *  - semaine -> 12 dernières semaines
 *  - mois    -> 12 derniers mois
 *  - tout    -> une valeur par année, sur tout l'historique
 */
async function getEvolution(periodeBrute) {
  const periode = normaliserPeriode(periodeBrute);

  const [mapContrats, mapDemandes, mapCA, mapDemandesStatut] = await Promise.all([
    recupererContratsParCle(periode),
    recupererDemandesParCle(periode),
    recupererCAParCle(periode),
    recupererDemandesStatutParCle(periode),
  ]);

  let buckets;
  if (periode === 'tout') {
    const cles = new Set([...mapContrats.keys(), ...mapDemandes.keys(), ...mapCA.keys()]);
    buckets = [...cles].sort().map((c) => ({ cle: c, label: c }));
    if (buckets.length === 0) {
      const anneeActuelle = String(new Date().getFullYear());
      buckets = [{ cle: anneeActuelle, label: anneeActuelle }];
    }
  } else {
    buckets = genererBuckets(periode);
  }

  return {
    periode,
    labels: buckets.map((b) => b.label),
    contrats: buckets.map((b) => (mapContrats.get(b.cle) || { nb: 0 }).nb),
    chiffre_affaires: buckets.map((b) => mapCA.get(b.cle) || 0),
    demandes: buckets.map((b) => mapDemandes.get(b.cle) || 0),
    demandes_par_statut: {
      en_attente: buckets.map((b) => (mapDemandesStatut.get(b.cle) || {}).attente || 0),
      validees: buckets.map((b) => (mapDemandesStatut.get(b.cle) || {}).validees || 0),
      rejetees: buckets.map((b) => (mapDemandesStatut.get(b.cle) || {}).rejetees || 0),
    },
  };
}

module.exports = { getCartesSynthese, getEvolution, getTopEmployes };