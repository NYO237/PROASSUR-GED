// services/aiService.js
const Groq = require("groq-sdk");

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) console.error("⚠️ [aiService] GROQ_API_KEY introuvable dans .env");

const client = apiKey ? new Groq({ apiKey }) : null;

// ─────────────────────────────────────────────────────────────
// RÈGLES SYSTÈME — reformulé plus court (~28% de tokens en moins) mais
// SANS retirer aucune règle cette fois (contrairement à une tentative
// précédente qui avait supprimé la règle MONTANTS et provoqué des erreurs).
// Voir aussi analyserTexteDocument() plus bas : la relance sur réponse
// suspecte est désactivée temporairement (trop d'appels Groq/tokens).
// ─────────────────────────────────────────────────────────────
const REGLES_SYSTEME = `Tu es un expert PROASSUR (assurance auto, Cameroun). Retourne UNIQUEMENT un JSON valide, sans markdown ni texte autour.

TYPE DE DOCUMENT (ordre de priorité) :
1. "attestation" si "Vignette ou DTA" présent. num_attestation=nombre 8-10 chiffres isolé près de cette mention. dta=montant après "Vignette ou DTA:".
2. "carte rose" si un code de 2 lettres apparaît deux fois d'affilée sur la même ligne, casse différente ou non (ex: "SW sw", "MH mh") — pas une immatriculation type "SW 520 BR" (lettres+chiffres ensemble). Autres indices : "CEDEAO", "carte internationale". num_carte_rose=nombre isolé de 8 chiffres plus loin dans le document (souvent le DERNIER de tout le texte, même après châssis/adresse) — jamais le châssis (alphanumérique).
3. "contrat" si "Conditions Particulières"/"Prime Nette"/"Décompte de prime"/"Responsabilité Civile"/"Avenant au contrat". Alors num_carte_rose=num_attestation=null.
4. "état de recettes" si "recettes" présent.
5. sinon "autre".

MONTANTS (prime_nette, prime_totale, accessoires, tva, carte_rose_montant, fc_automobile, dta, bonus) : le "." du texte source est un séparateur de milliers, jamais une décimale ("10.739"→10739, "1.000"→1000). Toujours des entiers, sans point.

POLICE : format XXXX/XXXXXXXXX ou XXXX-XXXXXXXXX. code_bureau=4 chiffres avant "/" ou "-". num_police=chiffres après, sans n° d'avenant.

date_emission : uniquement après "Emis le" (≠ date d'effet, ne jamais confondre). Absent → null, ne jamais réutiliser une autre date à la place. Toutes les dates (date_emission, date_effet, date_echeance) au format YYYY-MM-DD, jamais DD/MM/YYYY.

CONDUCTEUR : nom_conducteur=nom juste avant "Genre :" (retire numéro et préfixe M./Mme). Un "Conducteur :" différent plus bas est souvent un doublon OCR de l'assuré : ignore-le, priorité au nom avant "Genre :".

NOMS : ne jamais séparer nom et prénom (ni raison sociale) — nom complet dans nom_assure/nom_conducteur. prenom_assure et prenom_conducteur restent toujours null.

ADRESSE PROASSUR ("Wafa Assurance", "Rue Toyota", "Bonaprisso", "BP:5963 Douala") ≠ marque/modèle du véhicule (ex: "Toyota" de l'adresse n'est pas une marque) — cherche marque/modele près de "VEHICULE" ou d'un nom type "BLI BLI-150".

Extraire aussi (même carte rose/attestation) : nom_assure (sans M./Mme), immatriculation, marque, modele, numero_chassis, dates, code_bureau, num_police.

GARANTIES (contrat uniquement) : noms du tableau Garanties sans montants (ex: Responsabilité Civile, Recours Tierce Incendie, Défense et Recours, IPT, Aide à la Réparation). Sinon [].

JSON attendu :
{"type_document":"contrat|carte rose|attestation|état de recettes|autre","code_bureau":null,"num_police":null,"num_carte_rose":null,"num_attestation":null,"date_emission":null,"date_effet":null,"date_echeance":null,"nom_assure":null,"prenom_assure":null,"immatriculation":null,"marque":null,"modele":null,"numero_chassis":null,"nom_conducteur":null,"prenom_conducteur":null,"prime_nette":0,"prime_totale":0,"accessoires":0,"tva":0,"carte_rose_montant":0,"fc_automobile":0,"dta":0,"bonus":0,"garanties":[]}`;

// Un seul modèle : plus capable que llama-3.1-8b-instant, et avec un plafond
// journalier (TPD) DEUX FOIS plus généreux que llama-3.3-70b-versatile
// (200 000 vs 100 000 tokens/jour, tier gratuit) pour le même nombre de
// requêtes/jour. Plus besoin de routage ni d'escalade entre deux modèles.
const MODELE = "openai/gpt-oss-120b";

// ─────────────────────────────────────────────────────────────
// COMPTEUR DE TOKENS CUMULÉ (identique à avant)
// ─────────────────────────────────────────────────────────────
let compteurTokens = {
  prompt: 0,
  completion: 0,
  total: 0,
  cache: 0,
  appels: 0,
};

function reinitialiserCompteurTokens() {
  compteurTokens = { prompt: 0, completion: 0, total: 0, cache: 0, appels: 0 };
}

function getTotalTokensUtilises() {
  return { ...compteurTokens };
}

// Détecte une erreur 429 (rate limit) renvoyée par l'API Groq.
function estErreurRateLimit(erreur) {
  return erreur?.status === 429 || /\b429\b/.test(String(erreur?.message));
}

// Groq indique le délai d'attente dans le message d'erreur
// ("Please try again in 4.6125s") : on le réutilise plutôt que d'attendre
// une durée fixe arbitraire. +500ms de marge de sécurité.
function extraireAttenteMs(erreurMessage) {
  const m = String(erreurMessage).match(/try again in ([\d.]+)s/i);
  return m ? Math.ceil(parseFloat(m[1]) * 1000) + 500 : 5000;
}

async function appelerGroq(texteDocument, temperature, tentative = 1) {
  try {
    const completion = await client.chat.completions.create({
      model: MODELE,
      messages: [
        { role: "system", content: REGLES_SYSTEME },
        { role: "user", content: texteDocument },
      ],
      temperature,
      max_completion_tokens: 1500, // gpt-oss inclut du raisonnement interne, prévoir de la marge
      reasoning_effort: "low", // extraction simple : pas besoin d'un raisonnement poussé
      response_format: { type: "json_object" },
    });

    if (completion.usage) {
      compteurTokens.prompt += completion.usage.prompt_tokens || 0;
      compteurTokens.completion += completion.usage.completion_tokens || 0;
      compteurTokens.total += completion.usage.total_tokens || 0;
      compteurTokens.cache +=
        completion.usage.prompt_tokens_details?.cached_tokens || 0;
      compteurTokens.appels += 1;
    }

    return completion.choices[0].message.content;
  } catch (erreur) {
    // Rate limit (429) : Groq précise lui-même le délai à respecter avant de
    // réessayer. On retente jusqu'à 3 fois avant d'abandonner le document.
    if (estErreurRateLimit(erreur) && tentative <= 3) {
      const attente = extraireAttenteMs(erreur.message);
      console.warn(
        `[aiService] ⏳ Limite Groq (429), nouvelle tentative dans ${attente}ms (essai ${tentative}/3)`
      );
      await new Promise((r) => setTimeout(r, attente));
      return appelerGroq(texteDocument, temperature, tentative + 1);
    }
    throw erreur;
  }
}

// Retire les espaces pour comparer nombres/identifiants malgré les
// espacements variables de l'OCR (ex: "2012 / 1007000344" vs "20121007000344").
function normaliser(valeur) {
  return String(valeur).replace(/\s+/g, "");
}

function champTrouveDansTexte(valeur, texteNormalise) {
  if (!valeur) return true;
  return texteNormalise.includes(normaliser(valeur));
}

// Format attendu d'une immatriculation camerounaise : "LT 712 NJ", "LTMT 503 DQ"
const FORMAT_IMMATRICULATION = /^[A-Z]{2,5}\s?\d{2,4}\s?[A-Z]{1,3}$/i;

// Format de date attendu : YYYY-MM-DD (jamais DD/MM/YYYY ni autre variante)
const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Format source (documents PROASSUR) : DD/MM/YYYY, parfois suivi d'une heure
// ("08/05/2026 10:44"). Sert au filet de correction déterministe ci-dessous.
const FORMAT_DATE_FR = /^(\d{2})\/(\d{2})\/(\d{4})/;

// Jetons qui n'appartiennent qu'à l'adresse fixe du siège PROASSUR — s'ils
// se retrouvent dans marque/modele, c'est une confusion adresse/véhicule.
// NB : "bonapriss?o" couvre les deux orthographes vues dans les documents
// source ("Bonapriso", un seul "s" — celle réellement utilisée — et
// "Bonaprisso"). L'ancienne regex ne contenait que la variante à double "s"
// (jamais présente dans les vrais documents) : elle ne matchait donc jamais,
// ce qui a laissé passer modele="BONAPRISO" en BDD sans être détecté.
const JETONS_ADRESSE_PROASSUR = /wafa|bonapriss?o|toyota|douala|bp\s*:?\s*5963/i;

// Filet 0 token : repère un numéro de police (XXXX/XXXXXXXXX ou XXXX-XXXXXXXXX)
// directement dans le texte source, quand le modèle ne l'a pas trouvé lui-même
// (fréquent sur carte rose/attestation, texte OCR en désordre).
const FORMAT_POLICE_TEXTE = /\b(\d{4})\s*[\/-]\s*(\d{6,10})\b/;

// Filet 0 token : le vrai numéro d'attestation est toujours juste après la
// mention "Vignette ou DTA" (règle déjà donnée au modèle) — on revérifie par
// motif pour rattraper les cas où il prend un autre nombre à la place
// (ex: un numéro de police apparu plus haut dans le texte).
const FORMAT_APRES_VIGNETTE = /vignette\s+ou\s+dta[\s\S]{0,120}?\b(\d{8,10})\b/i;

// Motifs structurels utilisés pour repérer une attestation/carte rose que le
// modèle aurait classée à tort "autre" (voir bloc dédié dans
// reponseSembleSuspecte). Indépendants du JSON renvoyé : on les cherche
// directement dans le texte source.
const MOTIF_VIGNETTE_DTA = /vignette\s+ou\s+dta/i;
const MOTIF_CODE_DEUX_LETTRES_REPETE = /\b([A-Z]{2})\s+\1\b/i; // ex: "SW sw", "MH MH"
const MOTIF_NUMERO_8_CHIFFRES = /\b\d{8}\b/;

// Champs financiers : toujours des entiers FCFA, jamais des décimales.
const CHAMPS_FINANCIERS = [
  "prime_nette",
  "prime_totale",
  "accessoires",
  "tva",
  "carte_rose_montant",
  "fc_automobile",
  "dta",
  "bonus",
];

// Corrige, sur le TEXTE BRUT (avant JSON.parse), les montants où le modèle a
// recopié le "." du texte source comme séparateur de milliers ("10.739") en
// le laissant tel quel dans le JSON, ce qui en fait une fausse décimale une
// fois parsé (10.739 devient le nombre 10,739 au lieu de l'entier 10739).
// On ne peut faire cette reconstruction qu'AVANT le parse, car après coup
// l'information (le point d'origine) est perdue.
function corrigerSeparateursMilliers(rawJson) {
  let corrige = rawJson;
  for (const champ of CHAMPS_FINANCIERS) {
    const regex = new RegExp(`("${champ}"\\s*:\\s*)(\\d+)\\.(\\d{3})\\b`, "g");
    corrige = corrige.replace(
      regex,
      (match, prefixe, entiers, milliers) => `${prefixe}${entiers}${milliers}`,
    );
  }
  return corrige;
}

// Filet de sécurité anti-hallucination : vérifie que les champs critiques
// sont présents ET cohérents avec le texte source. Retourne `false` si tout
// va bien, ou une chaîne décrivant la raison précise du soupçon.
function reponseSembleSuspecte(rawJson, texteOriginal) {
  let data;
  try {
    data = JSON.parse(rawJson);
  } catch {
    return "JSON invalide";
  }

  const texteNormalise = normaliser(texteOriginal);

  if (
    data.type_document === "contrat" &&
    (!data.num_police || !data.prime_totale)
  ) {
    return "contrat sans num_police ou prime_totale";
  }
  if (data.type_document === "attestation" && !data.num_attestation) {
    return "attestation sans num_attestation";
  }
  if (data.type_document === "carte rose" && !data.num_carte_rose) {
    return "carte rose sans num_carte_rose";
  }

  // Les 3 vérifs ci-dessus supposent que type_document est déjà correct.
  // Un document mal classé "autre" ne déclenche AUCUNE d'entre elles, donc se
  // perd silencieusement (c'est exactement ce qui est arrivé sur la carte
  // rose du SUZUKI : classée "autre", jamais rattrapée). On vérifie donc
  // indépendamment si le texte source contient les motifs des règles 1/2 du
  // prompt, même quand le modèle dit "autre".
  if (data.type_document === "autre" || !data.type_document) {
    if (MOTIF_VIGNETTE_DTA.test(texteOriginal)) {
      return `type "autre" mais "Vignette ou DTA" présent dans le texte (probable attestation ratée)`;
    }
    if (
      MOTIF_CODE_DEUX_LETTRES_REPETE.test(texteOriginal) &&
      MOTIF_NUMERO_8_CHIFFRES.test(texteOriginal)
    ) {
      return `type "autre" mais motif de carte rose détecté (code 2 lettres répété + numéro 8 chiffres, probable carte rose ratée)`;
    }
  }

  for (const champ of [
    "num_police",
    "num_carte_rose",
    "num_attestation",
    "code_bureau",
    "numero_chassis",
  ]) {
    if (!champTrouveDansTexte(data[champ], texteNormalise)) {
      return `champ "${champ}"="${data[champ]}" absent du texte source (probable hallucination)`;
    }
  }

  for (const champDate of ["date_emission", "date_effet", "date_echeance"]) {
    const valeur = data[champDate];
    if (valeur && !FORMAT_DATE.test(valeur)) {
      return `format de date invalide sur "${champDate}"="${valeur}" (attendu YYYY-MM-DD)`;
    }
  }

  for (const champDate of ["date_emission", "date_effet", "date_echeance"]) {
    const valeur = data[champDate];
    if (valeur && !texteOriginal.includes(String(valeur).slice(0, 4))) {
      return `année de "${champDate}"="${valeur}" absente du texte source`;
    }
  }

  if (
    data.immatriculation &&
    !FORMAT_IMMATRICULATION.test(String(data.immatriculation).trim())
  ) {
    return `immatriculation "${data.immatriculation}" ne ressemble pas à une plaque (champ probablement mélangé)`;
  }

  if (
    JETONS_ADRESSE_PROASSUR.test(String(data.marque || "")) ||
    JETONS_ADRESSE_PROASSUR.test(String(data.modele || ""))
  ) {
    return `marque="${data.marque}"/modele="${data.modele}" ressemble à l'adresse du siège PROASSUR, pas au véhicule`;
  }

  // Un contrat a presque toujours des montants substantiels (centaines à
  // dizaines de milliers de FCFA) : une valeur à 1 chiffre trahit presque
  // toujours un "X.000" mal interprété (ex: "1.000" FCFA lu comme 1).
  if (data.type_document === "contrat") {
    for (const champ of CHAMPS_FINANCIERS) {
      const valeur = data[champ];
      if (
        typeof valeur === "number" &&
        valeur > 0 &&
        valeur < 100 &&
        champ !== "bonus"
      ) {
        return `champ financier "${champ}"=${valeur} anormalement faible pour un contrat (probable "X.000" mal interprété)`;
      }
    }
  }

  return false;
}

// Correction déterministe, 0 token
function appliquerCorrectionsDeterministes(rawJson, texteOriginal) {
  let data;
  try {
    data = JSON.parse(rawJson);
  } catch {
    return rawJson;
  }

  if (data.date_emission && !/emis\s+le/i.test(texteOriginal)) {
    data.date_emission = null;
  }

  // Filet de correction (0 token) : le modèle recopie parfois les dates au
  // format source DD/MM/YYYY au lieu du YYYY-MM-DD demandé — la colonne SQL
  // `date` rejette purement et simplement l'INSERT dans ce cas. Avant la
  // désactivation temporaire de la relance sur réponse suspecte, c'était
  // elle qui rattrapait ça (au prix d'un 2ᵉ appel Groq) ; ce correctif fait
  // la même chose gratuitement pour ce cas précis.
  for (const champDate of ["date_emission", "date_effet", "date_echeance"]) {
    const valeur = data[champDate];
    if (typeof valeur === "string") {
      const m = valeur.match(FORMAT_DATE_FR);
      if (m) data[champDate] = `${m[3]}-${m[2]}-${m[1]}`;
    }
  }

  // Filet de correction (0 token) : le modèle confond parfois l'adresse du
  // siège PROASSUR (présente sur chaque document) avec la marque/modèle du
  // véhicule (ex: marque="Toyota" à cause de "Rue Toyota" dans l'adresse).
  // Même logique que ci-dessus : la relance rattrapait ça avant, on vide
  // simplement le(s) champ(s) fautif(s) maintenant plutôt que de laisser une
  // fausse marque corrompre la fiche véhicule.
  if (JETONS_ADRESSE_PROASSUR.test(String(data.marque || ""))) data.marque = null;
  if (JETONS_ADRESSE_PROASSUR.test(String(data.modele || ""))) data.modele = null;

  // Le modèle sépare parfois nom/prénom malgré la consigne contraire :
  // on refusionne dans l'ordre d'origine (nom puis prénom) plutôt que de
  // payer une relance pour ça.
  if (data.prenom_assure) {
    data.nom_assure = [data.nom_assure, data.prenom_assure]
      .filter(Boolean)
      .join(" ");
    data.prenom_assure = null;
  }
  if (data.prenom_conducteur) {
    data.nom_conducteur = [data.nom_conducteur, data.prenom_conducteur]
      .filter(Boolean)
      .join(" ");
    data.prenom_conducteur = null;
  }

  // Filet 0 token : complète code_bureau/num_police par motif si le modèle
  // ne les a pas trouvés (fréquent sur carte rose/attestation).
  if (!data.code_bureau || !data.num_police) {
    const m = texteOriginal.match(FORMAT_POLICE_TEXTE);
    if (m) {
      data.code_bureau = data.code_bureau || m[1];
      data.num_police  = data.num_police  || m[2];
    }
  }

  // Filet 0 token : corrige un num_attestation qui serait en réalité un numéro
  // de police recopié par erreur (le vrai numéro est juste après "Vignette ou
  // DTA" dans le texte source).
  if (data.type_document === "attestation") {
    const m = texteOriginal.match(FORMAT_APRES_VIGNETTE);
    if (m && m[1] !== data.num_attestation) {
      console.warn(`[aiService] num_attestation corrigé par motif : "${data.num_attestation}" → "${m[1]}"`);
      data.num_attestation = m[1];
    }
  }

  // Bug récurrent observé sur les attestations : le modèle place parfois le
  // numéro d'attestation (8-10 chiffres isolés près de "Vignette ou DTA")
  // dans numero_chassis au lieu de num_attestation. Une attestation ne
  // mentionne jamais de châssis, donc on corrige ce glissement de champ.
  if (
    data.type_document === "attestation" &&
    !data.num_attestation &&
    data.numero_chassis &&
    /^\d{8,10}$/.test(String(data.numero_chassis))
  ) {
    data.num_attestation = data.numero_chassis;
    data.numero_chassis = null;
  }

  // Bug similaire sur les cartes roses : le modèle place parfois le numéro
  // de châssis dans immatriculation (aucun des deux "ne ressemble" à une
  // plaque dans ce cas). Une relance à température non nulle répète souvent
  // exactement la même erreur (coût gaspillé) : on corrige nous-mêmes plutôt.
  if (
    data.immatriculation &&
    !FORMAT_IMMATRICULATION.test(String(data.immatriculation).trim()) &&
    !data.numero_chassis
  ) {
    data.numero_chassis = data.immatriculation;
    data.immatriculation = null;
  }

  // Normalise les identifiants en chaînes (le modèle renvoie parfois un
  // nombre JSON au lieu d'une chaîne, ex: num_carte_rose:19877842).
  for (const champ of [
    "num_police",
    "num_carte_rose",
    "num_attestation",
    "code_bureau",
    "numero_chassis",
  ]) {
    if (typeof data[champ] === "number") {
      data[champ] = String(data[champ]);
    }
  }

  return JSON.stringify(data);
}

async function analyserTexteDocument(texteDocument) {
  if (!apiKey) throw new Error("Clé GROQ_API_KEY absente du fichier .env.");
  if (!client) throw new Error("Client Groq non initialisé.");

  try {
    let raw = await appelerGroq(texteDocument, 0); // température 0 : réponse la plus fiable/déterministe
    raw = corrigerSeparateursMilliers(raw); // doit passer AVANT le JSON.parse (voir commentaire de la fonction)
    raw = appliquerCorrectionsDeterministes(raw, texteDocument);

    // ── Relance sur réponse suspecte : DÉSACTIVÉE TEMPORAIREMENT ──────────
    // reponseSembleSuspecte() déclenchait trop souvent une 2ᵉ requête Groq
    // complète (coût x2 en tokens), ce qui consommait le quota trop vite.
    // La fonction reste définie plus haut dans ce fichier : pour la
    // réactiver, décommenter le bloc ci-dessous. Avant de la remettre, vaut
    // le coup de resserrer ses règles les plus bavardes (ex: le motif
    // carte-rose ajouté récemment) pour qu'elle ne se déclenche que sur des
    // cas vraiment ambigus.
    //
    // const raisonSuspecte = reponseSembleSuspecte(raw, texteDocument);
    // if (raisonSuspecte) {
    //   console.warn(`[aiService] Réponse suspecte : ${raisonSuspecte}`);
    //   console.warn("[aiService] Contenu brut avant nouvelle tentative :", raw);
    //   console.warn("[aiService] → nouvelle tentative (température non nulle pour varier l'échantillon).");
    //   raw = await appelerGroq(texteDocument, 0.3);
    //   raw = corrigerSeparateursMilliers(raw);
    //   raw = appliquerCorrectionsDeterministes(raw, texteDocument);
    //   const raisonApresRelance = reponseSembleSuspecte(raw, texteDocument);
    //   if (raisonApresRelance) {
    //     console.warn(`[aiService] ⚠️ Réponse toujours suspecte après relance : ${raisonApresRelance} — à vérifier manuellement.`);
    //   }
    // }

    console.log("[aiService] Réponse Groq brute :", raw);
    return raw;
  } catch (error) {
    console.error("❌ Erreur Groq :", error.message);
    throw error;
  }
}

module.exports = {
  analyserTexteDocument,
  reinitialiserCompteurTokens,
  getTotalTokensUtilises,
};