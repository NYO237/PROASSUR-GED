// services/StatsEmployeService.js
const pool = require("../config/db");

// ─── Utilitaires de dates ─────────────────────────────────────────────────

// Début de journée (minuit) pour une date donnée.
function debutJournee(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Début de semaine = lundi (convention FR), pas dimanche.
function debutSemaine(date) {
  const d = debutJournee(date);
  const jourSemaine = (d.getDay() + 6) % 7; // lundi=0 ... dimanche=6
  d.setDate(d.getDate() - jourSemaine);
  return d;
}

function debutMois(date) {
  const d = debutJournee(date);
  d.setDate(1);
  return d;
}

// Clé YYYY-MM-DD (locale, pas UTC, pour éviter les décalages de fuseau
// horaire qui feraient glisser un événement de 23h59 sur le mauvais jour).
function cleJour(date) {
  const d = new Date(date);
  const annee = d.getFullYear();
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

function normaliserLibelleDocument(libelle) {
  const l = (libelle || "").toLowerCase();
  if (l.includes("carte") || l.includes("rose")) return "cartes_roses";
  if (l.includes("attestation")) return "attestations";
  if (l.includes("contrat")) return "contrats_scannes";
  return "autres";
}

function normaliserStatutDemande(statut) {
  const s = (statut || "").toLowerCase().trim();
  if (s === "valide" || s === "validé" || s === "validée") return "validees";
  if (s === "rejete" || s === "rejeté" || s === "rejetee" || s === "rejetée") return "rejetees";
  return "en_attente";
}

// Normalise un texte pour comparaison : enlève accents, casse, ponctuation.
// Permet de comparer "NDOGMO Olivier" avec "ndogmo   olivier" ou
// "AGENCE LOGBESSOU - NDOGMO OLIVIER" sans faux négatifs.
function normaliserTexte(texte) {
  return (texte || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Détermine si l'employé (nom + prénom) est celui inscrit comme producteur
// sur le contrat. Comparaison par mots entiers (pas de sous-chaîne brute,
// pour éviter les faux positifs), insensible à l'ordre des mots, aux
// accents et à la casse.
function estProducteur(nomProducteur, nomEmploye, prenomEmploye) {
  const cible = normaliserTexte(nomProducteur);
  if (!cible) return false;

  const motsCible = new Set(cible.split(" "));
  const nom = normaliserTexte(nomEmploye);
  const prenom = normaliserTexte(prenomEmploye);

  const nomTrouve = nom !== "" && nom.split(" ").every((mot) => motsCible.has(mot));
  const prenomTrouve = prenom === "" || prenom.split(" ").every((mot) => motsCible.has(mot));

  return nomTrouve && prenomTrouve;
}

// Date retenue pour un contrat "produit" : la date d'émission inscrite sur
// le contrat si elle est disponible, sinon la date d'import du document.
function dateProductionContrat(contrat) {
  return contrat.date_emission || contrat.date_importation;
}

const CLES_PERIODES = ["aujourdhui", "semaine", "mois", "tout_temps"];

function periodeDocumentsVide() {
  return {
    total: 0,
    cartes_roses: 0,
    attestations: 0,
    contrats_scannes: 0,
  };
}

function periodeDemandesVide() {
  return {
    total: 0,
    validees: 0,
    rejetees: 0,
    en_attente: 0,
  };
}

// ─── Statistiques principales ─────────────────────────────────────────────
// Une seule requête par table, puis agrégation par période côté JS : évite
// de multiplier les allers-retours BDD pour chaque carte affichée.

async function recupererStatistiquesEmploye(idEmploye) {
  const maintenant = new Date();
  const seuils = {
    aujourdhui: debutJournee(maintenant),
    semaine: debutSemaine(maintenant),
    mois: debutMois(maintenant),
    tout_temps: null,
  };

  // Identité de l'employé : indispensable pour retrouver les contrats qu'il
  // a produits (comparaison avec le champ contrat.nom_producteur).
  const [employeRows] = await pool.query(
    `SELECT nom, prenom FROM employe WHERE id_utilisateur = ?`,
    [idEmploye],
  );
  const employe = employeRows[0] || { nom: "", prenom: "" };

  // Documents que CET employé a lui-même scannés / importés.
  const [documents] = await pool.query(
    `SELECT libelle, date_importation FROM document WHERE id_employe = ?`,
    [idEmploye],
  );

  // Demandes que CET employé a traitées (validées ou rejetées).
  const [demandes] = await pool.query(
    `SELECT statut_demande, date_demande FROM demande_contrat WHERE id_employe = ?`,
    [idEmploye],
  );

  // Tous les contrats de la compagnie : impossible de filtrer par
  // id_employe côté SQL, car la personne qui a scanné le contrat n'est pas
  // forcément celle qui l'a produit (vendu). On filtre ensuite en JS en
  // comparant nom_producteur au nom + prénom de l'employé connecté.
  const [contrats] = await pool.query(
    `SELECT c.nom_producteur, c.date_emission, d.date_importation
     FROM contrat c
     JOIN document d ON d.id_document = c.id_document`,
  );

  const contratsProduits = contrats.filter((c) =>
    estProducteur(c.nom_producteur, employe.nom, employe.prenom),
  );

  // Init des compteurs pour chaque période
  const documentsParPeriode = {};
  const demandesParPeriode = {};
  const contratsParPeriode = {};
  for (const cle of CLES_PERIODES) {
    documentsParPeriode[cle] = periodeDocumentsVide();
    demandesParPeriode[cle] = periodeDemandesVide();
    contratsParPeriode[cle] = 0;
  }

  documents.forEach((doc) => {
    const date = new Date(doc.date_importation);
    const type = normaliserLibelleDocument(doc.libelle);
    if (type === "autres") return;
    for (const cle of CLES_PERIODES) {
      const seuil = seuils[cle];
      if (!seuil || date >= seuil) {
        documentsParPeriode[cle][type]++;
        documentsParPeriode[cle].total++;
      }
    }
  });

  demandes.forEach((dem) => {
    const date = new Date(dem.date_demande);
    const statut = normaliserStatutDemande(dem.statut_demande);
    for (const cle of CLES_PERIODES) {
      const seuil = seuils[cle];
      if (!seuil || date >= seuil) {
        demandesParPeriode[cle].total++;
        demandesParPeriode[cle][statut]++;
      }
    }
  });

  contratsProduits.forEach((c) => {
    const date = new Date(dateProductionContrat(c));
    for (const cle of CLES_PERIODES) {
      const seuil = seuils[cle];
      if (!seuil || date >= seuil) {
        contratsParPeriode[cle]++;
      }
    }
  });

  return {
    documents: documentsParPeriode,
    demandes: demandesParPeriode,
    contrats: contratsParPeriode,
    evolution_demandes: construireEvolutionDemandes(demandes, 30, maintenant),
    evolution_contrats: construireEvolutionContrats(contratsProduits, 30, maintenant),
  };
}

// ─── Séries temporelles pour les graphiques d'évolution ───────────────────
// 30 derniers jours, un point par jour. Deux graphes distincts : l'un pour
// les demandes traitées, l'autre pour les contrats produits.

function listeDerniersJours(nbJours, maintenant) {
  const jours = [];
  const debut = debutJournee(maintenant);
  for (let i = nbJours - 1; i >= 0; i--) {
    const d = new Date(debut);
    d.setDate(d.getDate() - i);
    jours.push(d);
  }
  return jours;
}

// Graphique 1 : évolution des demandes traitées (validées / rejetées).
function construireEvolutionDemandes(demandes, nbJours, maintenant) {
  const parJour = {};
  listeDerniersJours(nbJours, maintenant).forEach((d) => {
    parJour[cleJour(d)] = { date: cleJour(d), demandes_validees: 0, demandes_rejetees: 0 };
  });

  demandes.forEach((dem) => {
    const cle = cleJour(dem.date_demande);
    if (!parJour[cle]) return;
    const statut = normaliserStatutDemande(dem.statut_demande);
    if (statut === "validees") parJour[cle].demandes_validees++;
    else if (statut === "rejetees") parJour[cle].demandes_rejetees++;
  });

  return Object.values(parJour);
}

// Graphique 2 : évolution des contrats produits par cet employé.
function construireEvolutionContrats(contratsProduits, nbJours, maintenant) {
  const parJour = {};
  listeDerniersJours(nbJours, maintenant).forEach((d) => {
    parJour[cleJour(d)] = { date: cleJour(d), contrats: 0 };
  });

  contratsProduits.forEach((c) => {
    const date = dateProductionContrat(c);
    if (!date) return;
    const cle = cleJour(date);
    if (parJour[cle]) parJour[cle].contrats++;
  });

  return Object.values(parJour);
}

module.exports = { recupererStatistiquesEmploye };