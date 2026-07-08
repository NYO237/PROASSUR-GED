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

module.exports = {
  extraireTextePdf,
  masquerDonneesSensibles,
  restaurerDonneesSensibles,
};
