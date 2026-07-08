// services/aiService.js
const Groq = require("groq-sdk");

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) console.error("⚠️ [aiService] GROQ_API_KEY introuvable dans .env");

const client = apiKey ? new Groq({ apiKey }) : null;

async function analyserTexteDocument(texteDocument) {
  if (!apiKey) throw new Error("Clé GROQ_API_KEY absente du fichier .env.");
  if (!client) throw new Error("Client Groq non initialisé.");

  // Pas de troncature : on garde tout le texte du document (sinon les infos sont perdues)
  const prompt = `
Tu es un expert en documents d'assurance automobile de la compagnie PROASSUR (Cameroun).
Analyse le texte brut ci-dessous et détermine le type de document selon ces règles STRICTES et PRIORITAIRES :

=== RÈGLE 1 — ATTESTATION (priorité maximale) ===
C'est une attestation SI le texte contient "Vignette ou DTA" OU "Vignette ou DTA:".
Dans ce cas :
- type_document = "attestation"
- num_attestation = le nombre de 8 à 10 chiffres qui apparaît seul sur une ligne près de "Vignette ou DTA"
- dta = le montant numérique après "Vignette ou DTA:" (ex: 30000)

=== RÈGLE 2 — CARTE ROSE (priorité haute) ===
C'est une carte rose SI le texte contient "SW" OU "sw" sur une ligne SEULE
OU contient "CEDEAO" OU "carte internationale".
ATTENTION : "SW 520 BR" ou toute immatriculation contenant "SW" N'EST PAS un indicateur de carte rose.
Le marqueur valide est "SW" ou "sw" isolé (ex: "SW sw" sur sa propre ligne).
Dans ce cas :
- type_document = "carte rose"
- num_carte_rose = le nombre isolé de 8 chiffres (ex: 19877841)

=== RÈGLE 3 — CONTRAT OU AVENANT ===
C'est un contrat/avenant SI le texte contient "Conditions Particulières" OU "Prime Nette" OU
"Décompte de prime" OU "Responsabilité Civile" OU "Avenant au contrat".
Dans ce cas :
- type_document = "contrat"
- num_carte_rose = null
- num_attestation = null

=== RÈGLE 4 — ÉTAT DE RECETTES ===
Contient "état de recettes" ou "recettes".
- type_document = "état de recettes"

=== RÈGLE 5 — AUTRE ===
Aucun des cas ci-dessus.
- type_document = "autre"

=== EXTRACTION DU NUMÉRO DE POLICE ===
Format XXXX/XXXXXXXXX ou XXXX-XXXXXXXXX, parfois répété plusieurs fois dans le texte.
- code_bureau = les 4 chiffres AVANT le "/" ou "-" (ex: "2012")
- num_police  = les chiffres APRÈS, sans numéro d'avenant (ex: "1001004139")
Exemples :
  "2012/1001004139" → code_bureau="2012", num_police="1001004139"
  "3016 - 1001000489 / 1" → code_bureau="3016", num_police="1001000489"

=== EXTRACTION DE LA DATE D'ÉMISSION ===
La date d'émission du contrat se trouve TOUJOURS en bas du document, après la mention
"Emis le" ou "Emis le :" (souvent juste avant "Fait à DOUALA").
Exemple : "Emis le 05/05/2026 12:45" → date_emission = "2026-05-05"
Ne confonds JAMAIS cette date avec "Date d'effet" : ce sont deux dates différentes.
Si "Emis le" n'apparaît pas dans le texte (cas d'une carte rose ou attestation courte),
date_emission = null.

=== EXTRACTION DES AUTRES CHAMPS (TOUS LES TYPES DE DOCUMENT) ===
Même pour une carte rose ou une attestation, extrais TOUJOURS si présents dans le texte :
nom_assure, immatriculation, marque, modele, numero_chassis, nom_conducteur, dates.
Ces informations apparaissent souvent même sur les documents courts comme la carte rose.

=== EXTRACTION DU NOM DE L'ASSURE ===
Pour le nom de l'assure retire le prefixe M. , Mme. ou autres devant le nom . S'il n'y en a pas laisse le tel qu'il est

=== FORMAT DE RÉPONSE ===
Retourne UNIQUEMENT ce JSON valide, sans texte autour, sans markdown :
{
  "type_document": "contrat" | "carte rose" | "attestation" | "état de recettes" | "autre",
  "code_bureau": "4 chiffres uniquement, ex: 2012",
  "num_police": "numéro de police sans code bureau, ex: 1001004139",
  "num_carte_rose": "8 chiffres si carte rose, sinon null",
  "num_attestation": "8 à 10 chiffres si attestation, sinon null",
  "date_emission" : "YYYY-MM-DD ou null",
  "date_effet": "YYYY-MM-DD ou null",
  "date_echeance": "YYYY-MM-DD ou null",
  "nom_assure": "nom ou raison sociale ou null",
  "prenom_assure": null,
  "immatriculation": "ex: LT 712 NJ ou null",
  "marque": "ex: SUZUKI ou null",
  "modele": "ex: DB52T1 ou null",
  "numero_chassis": "ex: XXXXXXDB52T253838 ou null",
  "nom_conducteur": "nom du conducteur ou null",
  "prenom_conducteur": null,
  "prime_nette": 0,
  "prime_totale": 0,
  "accessoires": 0,
  "tva": 0,
  "carte_rose_montant": 0,
  "fc_automobile": 0,
  "dta": 0,
  "bonus": 0
}

=== TEXTE DU DOCUMENT ===
${texteDocument}
`;

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      // model: "llama-3.1-8b-instant",

      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    console.log("[aiService] Réponse Groq brute :", raw);
    return raw;

  } catch (error) {
    console.error("❌ Erreur Groq :", error.message);
    throw error;
  }
}

module.exports = { analyserTexteDocument };