// services/dbScanService.js
const pool = require('../config/db');

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function normaliserType(type) {
  if (!type) return 'autre';
  const t = type.toLowerCase().trim();
  if (t.includes('contrat'))                             return 'contrat';
  if (t.includes('carte') || t.includes('rose'))         return 'carte rose';
  if (t.includes('attestation'))                         return 'attestation';
  if (t.includes('recette'))                             return 'état de recettes';
  return 'autre';
}

function separerPolice(codeBureau, numPolice) {
  if (!numPolice) return { code: codeBureau || '-', police: '-' };

  // Format "2012/1001004139"
  if (numPolice.includes('/')) {
    const parts = numPolice.split('/');
    const police = parts[1]?.trim().split(/[-\s]/)[0] || parts[1]?.trim();
    return { code: parts[0].trim(), police };
  }

  // Format "3016-1001000489" ou "3016 - 1001000489"
  if (numPolice.includes('-')) {
    const parts = numPolice.split('-');
    const codePart = parts[0].trim();
    const policePart = parts[1]?.trim().split(/[\/\s]/)[0] || parts[1]?.trim();
    if (/^\d{4}$/.test(codePart)) {
      return { code: codePart, police: policePart };
    }
  }

  return { code: codeBureau || '-', police: numPolice };
}

// ─── Vérification des fichiers déjà analysés ─────────────────────────────────
// Utilisé AVANT l'appel à l'IA pour ne pas gaspiller de tokens sur des fichiers
// déjà présents en BDD. Comparaison par nom EXACT + TAILLE en octets :
//  - "fichier.pdf" et "fichier (1).pdf" → noms différents → toujours distincts
//  - deux fichiers "contrat.pdf" mais de tailles différentes → distincts aussi
//    (ex: deux employés qui envoient chacun un fichier nommé pareil)

async function recupererFichiersExistants(fichiers) {
  const valides = (fichiers || []).filter((f) => f && f.nom);
  if (valides.length === 0) return new Set();

  const conditions = valides.map(() => '(nom_fichier = ? AND taille_fichier = ?)').join(' OR ');
  const valeurs = valides.flatMap((f) => [f.nom, f.taille]);

  const [rows] = await pool.query(
    `SELECT nom_fichier, taille_fichier FROM document WHERE ${conditions}`,
    valeurs
  );
  return new Set(rows.map((r) => `${r.nom_fichier}::${r.taille_fichier}`));
}

// ─── Insertion carte rose ─────────────────────────────────────────────────────

async function insererCarteRose(conn, donnees, idEmploye) {
  const numCR = donnees.num_carte_rose;
  if (!numCR) throw new Error("num_carte_rose manquant");

  const [exist] = await conn.query(
    `SELECT id_document FROM carte_rose WHERE num_carte_rose = ?`,
    [numCR]
  );
  if (exist.length > 0) {
    console.log(`[dbScanService] Carte rose ${numCR} déjà en BDD, id=${exist[0].id_document}`);
    return exist[0].id_document;
  }

  const [doc] = await conn.query(
    `INSERT INTO document (libelle, nom_fichier, taille_fichier, id_employe) VALUES (?, ?, ?, ?)`,
    ['carte rose', donnees.nom_fichier || null, donnees.taille_fichier || null, idEmploye]
  );
  const idDocument = doc.insertId;

  await conn.query(
    `INSERT INTO carte_rose (id_document, num_carte_rose) VALUES (?, ?)`,
    [idDocument, numCR]
  );

  console.log(`[dbScanService] ✅ Carte rose ${numCR} insérée, id=${idDocument}`);
  return idDocument;
}

// ─── Insertion attestation ────────────────────────────────────────────────────

async function insererAttestation(conn, donnees, idEmploye) {
  const numAtt = donnees.num_attestation;
  if (!numAtt) throw new Error("num_attestation manquant");

  const [exist] = await conn.query(
    `SELECT id_document FROM attestation WHERE num_attestation = ?`,
    [numAtt]
  );
  if (exist.length > 0) {
    console.log(`[dbScanService] Attestation ${numAtt} déjà en BDD, id=${exist[0].id_document}`);
    return exist[0].id_document;
  }

  const [doc] = await conn.query(
    `INSERT INTO document (libelle, nom_fichier, taille_fichier, id_employe) VALUES (?, ?, ?, ?)`,
    ['attestation', donnees.nom_fichier || null, donnees.taille_fichier || null, idEmploye]
  );
  const idDocument = doc.insertId;

  await conn.query(
    `INSERT INTO attestation (id_document, num_attestation) VALUES (?, ?)`,
    [idDocument, numAtt]
  );

  console.log(`[dbScanService] ✅ Attestation ${numAtt} insérée, id=${idDocument}`);
  return idDocument;
}

// ─── Insertion assuré + véhicule ─────────────────────────────────────────────

async function insererOuRecupererVehicule(conn, donnees) {
  const nomAssure = donnees.nom_assure || 'INCONNU';

  let idAssure;
  const [assureExist] = await conn.query(
    `SELECT id_assure FROM assure WHERE nom = ? AND (prenom <=> ? OR prenom IS NULL)`,
    [nomAssure, donnees.prenom_assure || null]
  );
  if (assureExist.length > 0) {
    idAssure = assureExist[0].id_assure;
  } else {
    const [r] = await conn.query(
      `INSERT INTO assure (nom, prenom) VALUES (?, ?)`,
      [nomAssure, donnees.prenom_assure || null]
    );
    idAssure = r.insertId;
  }

  if (!donnees.immatriculation) throw new Error("Immatriculation manquante pour le contrat");

  const [vExist] = await conn.query(
    `SELECT id_vehicule FROM vehicule WHERE immatriculation = ?`,
    [donnees.immatriculation]
  );
  if (vExist.length > 0) return vExist[0].id_vehicule;

  const chassis = donnees.numero_chassis || ('INCONNU-' + Date.now());
  const [vr] = await conn.query(
    `INSERT INTO vehicule
      (categorie, marque, modele, nb_place, numero_chassis, immatriculation,
       nom_conducteur, prenom_conducteur, id_assure)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'CAT 2',
      donnees.marque        || '-',
      donnees.modele        || '-',
      2,
      chassis,
      donnees.immatriculation,
      donnees.nom_conducteur    || null,
      donnees.prenom_conducteur || null,
      idAssure
    ]
  );
  return vr.insertId;
}

// ─── Fonction principale ──────────────────────────────────────────────────────

async function sauvegarderLotDocuments(documentsAnalyses, idEmploye) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Séparer par type
    const contrats     = documentsAnalyses.filter(d => normaliserType(d.type_document) === 'contrat');
    const cartesRoses  = documentsAnalyses.filter(d => normaliserType(d.type_document) === 'carte rose');
    const attestations = documentsAnalyses.filter(d => normaliserType(d.type_document) === 'attestation');

    console.log(`[dbScanService] Reçu: ${contrats.length} contrat(s), ${cartesRoses.length} carte(s) rose, ${attestations.length} attestation(s)`);

    // 2. Insérer carte rose et attestation en premier
    //    On stocke { doc, idDocument } pour retrouver par police ensuite
    const idsCartesRoses  = [];
    const idsAttestations = [];

    for (const cr of cartesRoses) {
      try {
        const idDoc = await insererCarteRose(conn, cr, idEmploye);
        idsCartesRoses.push({ doc: cr, idDocument: idDoc });
      } catch (e) {
        console.warn(`[dbScanService] ⚠️ Carte rose ignorée: ${e.message}`);
      }
    }

    for (const att of attestations) {
      try {
        const idDoc = await insererAttestation(conn, att, idEmploye);
        idsAttestations.push({ doc: att, idDocument: idDoc });
      } catch (e) {
        console.warn(`[dbScanService] ⚠️ Attestation ignorée: ${e.message}`);
      }
    }

    // 3. Insérer chaque contrat
    for (const contrat of contrats) {
      const { code, police } = separerPolice(contrat.code_bureau, contrat.num_police);

      // Rattachement par numéro de police (priorité) puis par immatriculation (fallback)
      let idCarteRose = idsCartesRoses.find(cr => {
        const p = separerPolice(cr.doc.code_bureau, cr.doc.num_police);
        return p.code === code && p.police === police;
      })?.idDocument
        || idsCartesRoses.find(cr => cr.doc.immatriculation === contrat.immatriculation)?.idDocument
        || null;

      let idAttestation = idsAttestations.find(att => {
        const p = separerPolice(att.doc.code_bureau, att.doc.num_police);
        return p.code === code && p.police === police;
      })?.idDocument
        || idsAttestations.find(att => att.doc.immatriculation === contrat.immatriculation)?.idDocument
        || null;

      console.log(`[dbScanService] Contrat ${code}/${police} | immat: ${contrat.immatriculation} | CR: ${idCarteRose} | ATT: ${idAttestation}`);

      // Contrat existant → mise à jour des FK manquantes
      const [contratExist] = await conn.query(
        `SELECT id_document FROM contrat WHERE code_bureau = ? AND num_police = ?`,
        [code, police]
      );

      if (contratExist.length > 0) {
        const idContrat = contratExist[0].id_document;
        await conn.query(
          `UPDATE contrat
           SET id_carte_rose  = COALESCE(id_carte_rose, ?),
               id_attestation = COALESCE(id_attestation, ?)
           WHERE id_document = ?`,
          [idCarteRose, idAttestation, idContrat]
        );
        console.log(`[dbScanService] 🔄 Contrat ${code}/${police} mis à jour (FK carte rose + attestation)`);
        continue;
      }

      // Nouveau contrat → insertion complète
      const idVehicule = await insererOuRecupererVehicule(conn, contrat);

      const [docResult] = await conn.query(
        `INSERT INTO document (libelle, nom_fichier, taille_fichier, id_employe) VALUES (?, ?, ?, ?)`,
        ['contrat', contrat.nom_fichier || null, contrat.taille_fichier || null, idEmploye]
      );
      const idDocument = docResult.insertId;

      await conn.query(
        `INSERT INTO contrat
          (id_document, code_bureau, num_police, date_emission, date_effet, date_echeance,
           duree, statut_validation, id_vehicule, id_carte_rose, id_attestation)
         VALUES (?, ?, ?, ?, ?, ?, 12, 'Brouillon', ?, ?, ?)`,
        [
          idDocument, code, police,
          // Si date_emission n'a pas été extraite (carte rose/attestation, ou texte coupé),
          // on retombe sur date_effet pour ne pas casser le filtre de la page production.
          contrat.date_emission || contrat.date_effet || null,
          contrat.date_effet    || null,
          contrat.date_echeance || null,
          idVehicule,
          idCarteRose   || null,
          idAttestation || null
        ]
      );

      await conn.query(
        `INSERT INTO prime
          (prime_nette, accessoires, dta, carte_rose, fc_automobile, tva, prime_totale, id_document)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          contrat.prime_nette        || 0,
          contrat.accessoires        || 0,
          contrat.dta                || 0,
          contrat.carte_rose_montant || 0,
          contrat.fc_automobile      || 0,
          contrat.tva                || 0,
          contrat.prime_totale       || 0,
          idDocument
        ]
      );

      await conn.query(
        `INSERT INTO reductions_majorations (bonus, id_document) VALUES (?, ?)`,
        [contrat.bonus || 0, idDocument]
      );

      console.log(`[dbScanService] ✅ Contrat ${code}/${police} inséré avec id=${idDocument}`);
    }

    await conn.commit();
    console.log(`[dbScanService] ✅ Lot sauvegardé avec succès.`);

  } catch (error) {
    await conn.rollback();
    console.error('[dbScanService] Erreur globale, rollback :', error.message);
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = { sauvegarderLotDocuments, recupererFichiersExistants };