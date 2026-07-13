// services/pdfService.js
const pdf = require("pdf-parse");

async function extraireTextePdf(buffer) {
  try {
    if (!buffer) {
      throw new Error("Le buffer du fichier est invalide ou manquant.");
    }

    // Gestion robuste de l'import : pdf-parse peut être une fonction,
    // ou un objet contenant la fonction dans .default ou .PDFParse
    let parseFunction = null;
    if (typeof pdf === "function") parseFunction = pdf;
    else if (pdf && typeof pdf.default === "function")
      parseFunction = pdf.default;
    else if (pdf && typeof pdf.PDFParse === "function")
      parseFunction = pdf.PDFParse;

    if (typeof parseFunction !== "function") {
      throw new Error(
        `La bibliothèque 'pdf-parse' n'est pas utilisable (type détecté: ${typeof pdf}). Vérifiez l'installation.`,
      );
    }

    const data = await parseFunction(buffer);
    return data?.text || "";
  } catch (error) {
    console.error("❌ [pdfService] Erreur extraction PDF :", error.message);
    throw error;
  }
}

function masquerDonneesSensibles(texteBrut) {
  return { texteAnonyme: texteBrut, tableCorrespondance: {} };
}

function restaurerDonneesSensibles(jsonAnonyme, tableCorrespondance) {
  return jsonAnonyme;
}

// ─── Filet de sécurité : numéro de police par motif ──────────────────────────
// Sur certains documents (carte rose notamment), pdf-parse produit un texte
// très désordonné — colonnes qui se chevauchent, contenu dupliqué — où le
// numéro de police n'apparaît parfois qu'UNE SEULE fois, noyé dans le bruit.
// L'IA le rate alors, même si l'information est bel et bien présente dans le
// texte qu'on lui envoie. On la retrouve ici indépendamment de l'IA, par
// motif : "XXXX/XXXXXXXXXX" ou "XXXX-XXXXXXXXXX" (avec ou sans espaces
// autour du séparateur), ex: "2012/1002000704", "2012 - 1002000704".
//
// À utiliser en complément de l'IA, jamais à la place : on ne l'appelle que
// si l'IA n'a pas renvoyé de code_bureau/num_police pour le document.
function extrairePoliceParPattern(texteBrut) {
  if (!texteBrut) return null;

  const regex = /\b(\d{4})\s*[\/\-]\s*(\d{6,12})\b/g;
  const occurrences = new Map(); // "code/police" → nombre d'apparitions
  let match;

  while ((match = regex.exec(texteBrut)) !== null) {
    const cle = `${match[1]}/${match[2]}`;
    occurrences.set(cle, (occurrences.get(cle) || 0) + 1);
  }

  if (occurrences.size === 0) return null;

  // La vraie police a le plus de chances d'être la combinaison la plus
  // fréquente (documents dupliqués sur la page, en-tête + pied de page...).
  // À fréquence égale, on garde la première rencontrée.
  let meilleureCle = null;
  let meilleurCompte = 0;
  for (const [cle, compte] of occurrences) {
    if (compte > meilleurCompte) {
      meilleureCle = cle;
      meilleurCompte = compte;
    }
  }

  const [code_bureau, num_police] = meilleureCle.split('/');
  return { code_bureau, num_police };
}

module.exports = {
  extraireTextePdf,
  masquerDonneesSensibles,
  restaurerDonneesSensibles,
  extrairePoliceParPattern,
};