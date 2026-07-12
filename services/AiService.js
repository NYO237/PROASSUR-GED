// services/aiService.js
const Groq = require("groq-sdk");

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) console.error("⚠️ [aiService] GROQ_API_KEY introuvable dans .env");

const client = apiKey ? new Groq({ apiKey }) : null;

// ─────────────────────────────────────────────────────────────
// RÈGLES SYSTÈME (prompt compressé, inchangé par rapport à avant)
// ─────────────────────────────────────────────────────────────
const REGLES_SYSTEME = `Tu es un expert PROASSUR (assurance auto, Cameroun). Retourne UNIQUEMENT un JSON valide, sans markdown ni texte autour.

TYPE DE DOCUMENT (ordre de priorité) :
1. "attestation" si "Vignette ou DTA" présent. num_attestation=nombre 8-10 chiffres isolé près de cette mention. dta=montant après "Vignette ou DTA:".
2. "carte rose" si un code de 2 LETTRES (ex: "SW", "MD", ou toute autre paire de lettres) apparaît ISOLÉ SEUL sur sa propre ligne (PAS une immatriculation type "SW 520 BR" où lettres et chiffres sont sur la MÊME ligne), généralement suivi un peu plus loin d'un nombre isolé de 8 chiffres. Autres indices : "CEDEAO", "carte internationale". num_carte_rose=ce nombre isolé de 8 chiffres.
3. "contrat" si "Conditions Particulières" ou "Prime Nette" ou "Décompte de prime" ou "Responsabilité Civile" ou "Avenant au contrat". Alors num_carte_rose=null et num_attestation=null.
4. "état de recettes" si "état de recettes"/"recettes" présent.
5. sinon "autre".

MONTANTS (prime_nette, prime_totale, accessoires, tva, carte_rose_montant, fc_automobile, dta, bonus) : dans les documents PROASSUR, le "." est un SÉPARATEUR DE MILLIERS, jamais une décimale. "10.739" signifie 10739 (dix mille sept cent trente-neuf), "1.000" signifie 1000. Retourne TOUJOURS ces champs comme des nombres ENTIERS, sans point (10739, pas 10.739 ; 1000, pas 1 ni 1.000).

EXTRACTION NUMÉRO DE POLICE : format XXXX/XXXXXXXXX ou XXXX-XXXXXXXXX. code_bureau=4 chiffres avant "/" ou "-". num_police=chiffres après, sans n° d'avenant. Ex: "2012/1001004139"→bureau="2012", police="1001004139".

DATE D'ÉMISSION : après "Emis le" (souvent juste avant "Fait à DOUALA"), format YYYY-MM-DD. Ne JAMAIS confondre avec "Date d'effet". Absent → null (ne JAMAIS réutiliser une autre date à la place).

CONDUCTEUR : nom_conducteur = le nom juste AVANT "Genre :" dans la section "Caractéristiques Véhicule" (ex: "1 M. MBATCHOU STEPHANE YANAISE" → nom_conducteur="MBATCHOU STEPHANE YANAISE", retire le numéro et le préfixe M./Mme.). Un champ "Conducteur :" plus bas contenant un nom différent est souvent une erreur OCR qui répète le nom de l'assuré : ignore-le si ça arrive, priorité au nom avant "Genre :".

NOMS : ne JAMAIS séparer nom et prénom. Mets le nom complet (tous les mots) dans nom_assure et dans nom_conducteur. prenom_assure et prenom_conducteur restent TOUJOURS null, même si le nom contient plusieurs mots.

ADRESSE PROASSUR (à ignorer pour marque/modèle) : le texte contient souvent l'adresse du siège PROASSUR, reconnaissable à "Wafa Assurance", "Rue Toyota", "Bonaprisо"/"Bonaprisso" ou "BP:5963 Douala". Ce n'est JAMAIS la marque ou le modèle du véhicule (ex: "Toyota" dans cette adresse n'est pas une marque de voiture) — cherche marque/modele ailleurs dans le texte (souvent près de "VEHICULE" ou d'un nom de modèle type "BLI BLI-150").

AUTRES CHAMPS (toujours extraire si présents, même carte rose/attestation) : nom_assure (retirer préfixe M./Mme.), immatriculation, marque, modele, numero_chassis, dates.

JSON attendu :
{"type_document":"contrat|carte rose|attestation|état de recettes|autre","code_bureau":null,"num_police":null,"num_carte_rose":null,"num_attestation":null,"date_emission":null,"date_effet":null,"date_echeance":null,"nom_assure":null,"prenom_assure":null,"immatriculation":null,"marque":null,"modele":null,"numero_chassis":null,"nom_conducteur":null,"prenom_conducteur":null,"prime_nette":0,"prime_totale":0,"accessoires":0,"tva":0,"carte_rose_montant":0,"fc_automobile":0,"dta":0,"bonus":0}`;

// Un seul modèle : plus capable que llama-3.1-8b-instant, et avec un plafond
// journalier (TPD) DEUX FOIS plus généreux que llama-3.3-70b-versatile
// (200 000 vs 100 000 tokens/jour, tier gratuit) pour le même nombre de
// requêtes/jour. Plus besoin de routage ni d'escalade entre deux modèles.
const MODELE = "openai/gpt-oss-120b";

// ─────────────────────────────────────────────────────────────
// COMPTEUR DE TOKENS CUMULÉ (identique à avant)
// ─────────────────────────────────────────────────────────────
let compteurTokens = { prompt: 0, completion: 0, total: 0, cache: 0, appels: 0 };

function reinitialiserCompteurTokens() {
  compteurTokens = { prompt: 0, completion: 0, total: 0, cache: 0, appels: 0 };
}

function getTotalTokensUtilises() {
  return { ...compteurTokens };
}

async function appelerGroq(texteDocument, temperature) {
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
    compteurTokens.cache += completion.usage.prompt_tokens_details?.cached_tokens || 0;
    compteurTokens.appels += 1;
  }

  return completion.choices[0].message.content;
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

// Jetons qui n'appartiennent qu'à l'adresse fixe du siège PROASSUR — s'ils
// se retrouvent dans marque/modele, c'est une confusion adresse/véhicule.
const JETONS_ADRESSE_PROASSUR = /wafa|bonaprisso|bonaprisso|bonaprisо|toyota|douala|bp\s*:?\s*5963/i;

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
    corrige = corrige.replace(regex, (match, prefixe, entiers, milliers) => `${prefixe}${entiers}${milliers}`);
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

  if (data.type_document === "contrat" && (!data.num_police || !data.prime_totale)) {
    return "contrat sans num_police ou prime_totale";
  }
  if (data.type_document === "attestation" && !data.num_attestation) {
    return "attestation sans num_attestation";
  }
  if (data.type_document === "carte rose" && !data.num_carte_rose) {
    return "carte rose sans num_carte_rose";
  }

  for (const champ of ["num_police", "num_carte_rose", "num_attestation", "code_bureau", "numero_chassis"]) {
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

  if (data.immatriculation && !FORMAT_IMMATRICULATION.test(String(data.immatriculation).trim())) {
    return `immatriculation "${data.immatriculation}" ne ressemble pas à une plaque (champ probablement mélangé)`;
  }

  if (JETONS_ADRESSE_PROASSUR.test(String(data.marque || "")) || JETONS_ADRESSE_PROASSUR.test(String(data.modele || ""))) {
    return `marque="${data.marque}"/modele="${data.modele}" ressemble à l'adresse du siège PROASSUR, pas au véhicule`;
  }

  // Un contrat a presque toujours des montants substantiels (centaines à
  // dizaines de milliers de FCFA) : une valeur à 1 chiffre trahit presque
  // toujours un "X.000" mal interprété (ex: "1.000" FCFA lu comme 1).
  if (data.type_document === "contrat") {
    for (const champ of CHAMPS_FINANCIERS) {
      const valeur = data[champ];
      if (typeof valeur === "number" && valeur > 0 && valeur < 100 && champ !== "bonus") {
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

  // Le modèle sépare parfois nom/prénom malgré la consigne contraire :
  // on refusionne dans l'ordre d'origine (nom puis prénom) plutôt que de
  // payer une relance pour ça.
  if (data.prenom_assure) {
    data.nom_assure = [data.nom_assure, data.prenom_assure].filter(Boolean).join(" ");
    data.prenom_assure = null;
  }
  if (data.prenom_conducteur) {
    data.nom_conducteur = [data.nom_conducteur, data.prenom_conducteur].filter(Boolean).join(" ");
    data.prenom_conducteur = null;
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
  for (const champ of ["num_police", "num_carte_rose", "num_attestation", "code_bureau", "numero_chassis"]) {
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

    const raisonSuspecte = reponseSembleSuspecte(raw, texteDocument);
    if (raisonSuspecte) {
      console.warn(`[aiService] Réponse suspecte : ${raisonSuspecte}`);
      console.warn("[aiService] Contenu brut avant nouvelle tentative :", raw);
      console.warn("[aiService] → nouvelle tentative (température non nulle pour varier l'échantillon).");

      // À température 0, une deuxième tentative donnerait la même réponse
      // (fausse). On varie légèrement la température pour obtenir un autre
      // essai du même modèle plutôt que d'escalader vers un modèle différent.
      raw = await appelerGroq(texteDocument, 0.3);
      raw = corrigerSeparateursMilliers(raw);
      raw = appliquerCorrectionsDeterministes(raw, texteDocument);

      const raisonApresRelance = reponseSembleSuspecte(raw, texteDocument);
      if (raisonApresRelance) {
        console.warn(
          `[aiService] ⚠️ Réponse toujours suspecte après relance : ${raisonApresRelance} — à vérifier manuellement.`
        );
      }
    }

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