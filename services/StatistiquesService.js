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
 * Cartes de synthèse : contrats, CA, véhicules assurés, assurés, demandes
 * pour la période demandée, avec évolution vs période précédente équivalente.
 */
async function getCartesSynthese(periodeBrute) {
  const periode = normaliserPeriode(periodeBrute);
  const clContrat = clausesPeriode('c.date_emission', periode);
  const clDemande = clausesPeriode('d.date_demande', periode);
  const clRapport = clausesPeriode('r.date_rapport', periode);

  const [lignesContrats] = await pool.query(`
    SELECT
      COUNT(DISTINCT CASE WHEN ${clContrat.actuel} THEN c.id_document END) AS contrats_actuel,
      COUNT(DISTINCT CASE WHEN ${clContrat.precedent} THEN c.id_document END) AS contrats_precedent,
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
      COUNT(CASE WHEN ${clDemande.actuel} THEN 1 END) AS demandes_actuel,
      COUNT(CASE WHEN ${clDemande.precedent} THEN 1 END) AS demandes_precedent
    FROM demande_contrat d
  `);
  const dRow = lignesDemandes[0];

  return {
    periode,
    contrats: s.contrats_actuel,
    ca: Number(caRow.ca_actuel),
    vehicules_assures: s.vehicules_actuel,
    assures: s.assures_actuel,
    demandes: dRow.demandes_actuel,
    evolution_contrats: calculEvolution(s.contrats_actuel, s.contrats_precedent),
    evolution_ca: calculEvolution(caRow.ca_actuel, caRow.ca_precedent),
    evolution_demandes: calculEvolution(dRow.demandes_actuel, dRow.demandes_precedent),
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

  const [mapContrats, mapDemandes, mapCA] = await Promise.all([
    recupererContratsParCle(periode),
    recupererDemandesParCle(periode),
    recupererCAParCle(periode),
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
  };
}

module.exports = { getCartesSynthese, getEvolution };