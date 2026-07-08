// controllers/scanController.js
const pdfService = require("../services/pdfService");
const aiService = require("../services/aiService");
const { sauvegarderLotDocuments, recupererFichiersExistants } = require('../services/dbScanService');

function parseAiJson(rawText) {
  if (typeof rawText !== "string") return rawText;
  try {
    const cleaned = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

async function scannerLotDossiers(req, res) {
  try {
    const files = req.files || (req.file ? [req.file] : []);

    if (files.length === 0) {
      return res.status(400).json({ success: false, message: "Aucun fichier détecté." });
    }

    const idEmploye = req.user?.id;
    if (!idEmploye) {
      return res.status(401).json({ success: false, message: "Utilisateur non authentifié." });
    }

    // ── Optimisation : on évite d'envoyer à l'IA les fichiers déjà analysés ──
    // Comparaison par nom EXACT + TAILLE (ex: "fichier.pdf" et "fichier (1).pdf"
    // restent distincts ; deux fichiers de même nom mais de tailles différentes
    // aussi, pour éviter de confondre deux documents différents).
    const fichiersRecus = files.map((f) => ({ nom: f.originalname, taille: f.size }));
    const fichiersDejaEnBD = await recupererFichiersExistants(fichiersRecus);

    let stats = { contrats: 0, recettes: 0, cartes_roses: 0, attestations: 0 };
    const results = [];
    let nbIgnores = 0;

    // ── Traitement séquentiel des fichiers ──────────────────────────────────
    for (const file of files) {
      const cleFichier = `${file.originalname}::${file.size}`;
      if (fichiersDejaEnBD.has(cleFichier)) {
        console.log(`[Scanner] Fichier déjà en BDD, ignoré (pas d'appel IA) : ${file.originalname} (${file.size} octets)`);
        nbIgnores++;
        results.push(null);
        continue;
      }

      const estUnPdf =
        file.mimetype === "application/pdf" ||
        file.originalname.toLowerCase().endsWith(".pdf");

      if (!estUnPdf) { results.push(null); continue; }

      try {
        const texteBrut = await pdfService.extraireTextePdf(file.buffer);
        if (!texteBrut || texteBrut.trim().length === 0) { results.push(null); continue; }

        const { texteAnonyme, tableCorrespondance } = pdfService.masquerDonneesSensibles(texteBrut);
        const rawAiResponse = await aiService.analyserTexteDocument(texteAnonyme);
        const jsonDoc = parseAiJson(rawAiResponse);

        console.log(`[Scanner] JSON extrait pour ${file.originalname}:`, JSON.stringify(jsonDoc, null, 2));

        if (!jsonDoc) { results.push(null); continue; }

        const jsonRestaure = pdfService.restaurerDonneesSensibles(jsonDoc, tableCorrespondance);
        jsonRestaure.nom_fichier = file.originalname;   // ← utilisés plus loin pour l'insertion en BDD
        jsonRestaure.taille_fichier = file.size;
        results.push(jsonRestaure);

        // Délai pour respecter le quota API Groq
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (fileError) {
        console.error(`[Scanner] Erreur fichier ${file.originalname}:`, fileError.message);
        results.push(null);
      }
    }

    // ── Filtrage des résultats valides ──────────────────────────────────────
    const documentsAnalyses = results.filter((d) => d !== null);

    if (documentsAnalyses.length === 0) {
      if (nbIgnores > 0 && nbIgnores === files.length) {
        return res.status(200).json({
          success: true,
          message: "Tous les fichiers sélectionnés ont déjà été analysés précédemment.",
          statistiques: stats,
          lignes: [],
          fichiers_ignores: nbIgnores,
        });
      }
      return res.status(422).json({
        success: false,
        message: "Aucun fichier PDF valide ou lisible n'a été trouvé.",
      });
    }

    // ── Sauvegarde groupée en BDD (carte rose + attestation avant contrat) ──
    let erreurSauvegardeBDD = null;
    try {
      await sauvegarderLotDocuments(documentsAnalyses, idEmploye);
      console.log(`[Scanner] ✅ Lot sauvegardé en BDD`);
    } catch (dbError) {
      console.error(`[Scanner] ⚠️ Erreur BDD globale:`, dbError.message);
      // On continue pour afficher le tableau même si la BDD échoue, mais on
      // garde l'erreur pour la remonter dans la réponse (voir plus bas) :
      // sans ça, l'échec de sauvegarde est invisible pour l'utilisateur.
      erreurSauvegardeBDD = dbError.message;
    }

    // ── Calcul des stats + agrégation par numéro de police ─────────────────
    const structurePolices = {};

    documentsAnalyses.forEach((doc) => {
      // Stats par type
      const type = (doc.type_document || "").toLowerCase();
      if (type.includes("contrat"))                              stats.contrats++;
      else if (type.includes("recette"))                         stats.recettes++;
      else if (type.includes("carte") || type.includes("rose")) stats.cartes_roses++;
      else if (type.includes("attestation"))                     stats.attestations++;

      // Clé de regroupement par police
      const codePolice = `${doc.code_bureau || ""}-${doc.num_police || ""}`;
      if (!doc.num_police || doc.num_police === "-") return;

      if (!structurePolices[codePolice]) {
        // Première entrée pour cette police
        structurePolices[codePolice] = {
          bureau:             doc.code_bureau    || "-",
          numero_police:      doc.num_police     || "-",
          numero_carte_rose:  doc.num_carte_rose || "-",
          numero_attestation: doc.num_attestation || "-",
          nom_client:         doc.nom_assure     || "-",
          prenom_client:      doc.prenom_assure  || "-",
          vehicule:           `${doc.marque || ""} ${doc.modele || ""}`.trim() || "-",
          nom_conducteur:     doc.nom_conducteur || "-",
          // prenom_conducteur:  doc.prenom_conducteur || "-",
          prime_nette:        doc.prime_nette    || "0",
        };
      } else {
        // Fusion : on complète les champs manquants avec les autres documents
        const entry = structurePolices[codePolice];
        if (entry.numero_carte_rose  === "-" && doc.num_carte_rose)  entry.numero_carte_rose  = doc.num_carte_rose;
        if (entry.numero_attestation === "-" && doc.num_attestation) entry.numero_attestation = doc.num_attestation;
        if (entry.nom_client         === "-" && doc.nom_assure)      entry.nom_client         = doc.nom_assure;
        if (entry.vehicule           === "-" && (doc.marque || doc.modele)) {
          entry.vehicule = `${doc.marque || ""} ${doc.modele || ""}`.trim();
        }
        if (entry.prime_nette === "0" && doc.prime_nette) entry.prime_nette = doc.prime_nette;
      }
    });

    return res.status(200).json({
      success: true,
      statistiques: stats,
      lignes: Object.values(structurePolices),
      fichiers_ignores: nbIgnores,
      avertissement_bdd: erreurSauvegardeBDD, // null si tout s'est bien sauvegardé
    });

  } catch (error) {
    console.error("Erreur critique globale du scanneur :", error);
    return res.status(500).json({
      success: false,
      message: "Une erreur interne est survenue.",
      error: error.message,
    });
  }
}

module.exports = { scannerLotDossiers };