// controllers/scanController.js
const pdfService = require("../services/pdfService");
const aiService = require("../services/AiService");
const { sauvegarderLotDocuments, recupererFichiersExistants } = require('../services/DbScanService');

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

// Comparaison de noms tolérante à la casse et aux espaces, utilisée pour le
// rattachement de secours ci-dessous (même logique que côté DbScanService).
function nomsCorrespondent(nomA, nomB) {
  if (!nomA || !nomB) return false;
  const normaliser = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');
  return normaliser(nomA) === normaliser(nomB);
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

    // On repart de zéro pour le suivi des tokens de ce lot précis
    aiService.reinitialiserCompteurTokens();

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

        // ── Filet de sécurité : numéro de police par motif regex ───────────
        // Sur certains documents (carte rose surtout), le texte extrait par
        // pdf-parse est tellement désordonné que l'IA rate le numéro de
        // police alors qu'il est bien présent dans le texte envoyé. On le
        // retrouve ici indépendamment de l'IA, uniquement si elle ne l'a pas
        // donné, pour ne jamais écraser une valeur déjà correcte.
        if (!jsonRestaure.num_police || !jsonRestaure.code_bureau) {
          const policeDetectee = pdfService.extrairePoliceParPattern(texteBrut);
          if (policeDetectee) {
            console.log(`[Scanner] Police retrouvée par motif pour ${file.originalname} : ${policeDetectee.code_bureau}/${policeDetectee.num_police}`);
            jsonRestaure.code_bureau = jsonRestaure.code_bureau || policeDetectee.code_bureau;
            jsonRestaure.num_police  = jsonRestaure.num_police  || policeDetectee.num_police;
          }
        }

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

    // ── Bilan de consommation de tokens pour ce lot ─────────────────────────
    const usageTokens = aiService.getTotalTokensUtilises();
    console.log(
      `[Scanner] Tokens utilisés pour ce lot : ${usageTokens.total} ` +
      `(${usageTokens.prompt} entrée / ${usageTokens.completion} sortie, ${usageTokens.cache} en cache, ${usageTokens.appels} appel(s) Groq)`
    );

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
          tokens_utilises: usageTokens,
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
    // Documents sans num_police exploitable (ex: carte rose dont la mise en
    // page ne fait pas apparaître clairement la police) : on les met de côté
    // pour tenter un rattachement de secours après la première passe.
    const orphelins = [];

    documentsAnalyses.forEach((doc) => {
      // Stats par type
      const type = (doc.type_document || "").toLowerCase();
      if (type.includes("contrat"))                              stats.contrats++;
      else if (type.includes("recette"))                         stats.recettes++;
      else if (type.includes("carte") || type.includes("rose")) stats.cartes_roses++;
      else if (type.includes("attestation"))                     stats.attestations++;

      if (!doc.num_police || doc.num_police === "-") {
        orphelins.push(doc);
        return;
      }

      // Clé de regroupement par police
      const codePolice = `${doc.code_bureau || ""}-${doc.num_police || ""}`;

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
        if (entry.nom_conducteur === "-" && doc.nom_conducteur) entry.nom_conducteur = doc.nom_conducteur;
        if (entry.prime_nette === "0" && doc.prime_nette) entry.prime_nette = doc.prime_nette;
      }
    });

    // ── Rattachement de secours des orphelins par nom d'assuré ─────────────
    // Cas typique : une carte rose ou attestation dont l'IA n'a pas pu lire
    // le numéro de police sur le document, mais dont le nom de l'assuré
    // correspond bien à celui d'un contrat déjà placé dans structurePolices.
    orphelins.forEach((doc) => {
      if (!doc.nom_assure) return;

      const entree = Object.values(structurePolices).find((e) =>
        nomsCorrespondent(e.nom_client, doc.nom_assure)
      );
      if (!entree) return;

      if (entree.numero_carte_rose  === "-" && doc.num_carte_rose)  entree.numero_carte_rose  = doc.num_carte_rose;
      if (entree.numero_attestation === "-" && doc.num_attestation) entree.numero_attestation = doc.num_attestation;
      if (entree.vehicule           === "-" && (doc.marque || doc.modele)) {
        entree.vehicule = `${doc.marque || ""} ${doc.modele || ""}`.trim();
      }
      if (entree.nom_conducteur === "-" && doc.nom_conducteur) entree.nom_conducteur = doc.nom_conducteur;
      if (entree.prime_nette === "0" && doc.prime_nette) entree.prime_nette = doc.prime_nette;
    });

    return res.status(200).json({
      success: true,
      statistiques: stats,
      lignes: Object.values(structurePolices),
      fichiers_ignores: nbIgnores,
      avertissement_bdd: erreurSauvegardeBDD, // null si tout s'est bien sauvegardé
      tokens_utilises: usageTokens,
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