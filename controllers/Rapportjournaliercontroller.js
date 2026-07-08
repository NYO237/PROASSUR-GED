// controllers/rapportJournalierController.js
const ExcelJS   = require('exceljs');
const { analyserSituationEncaissements, analyserBordereauCommissions } = require('../services/AiRapportservice');
const rapportService = require('../services/RapportJournalierService');

// ── POST /api/rapport-journalier/scan ─────────────────────────────────────────
async function scannerRapportJournalier(req, res) {
  try {
    const idEmploye = req.user?.id;
    if (!idEmploye) return res.status(401).json({ success: false, message: 'Non authentifié.' });

    const files = req.files || {};
    const fichierEncaissements = files.encaissements?.[0];
    const fichierCommissions   = files.commissions?.[0];

    if (!fichierEncaissements) {
      return res.status(400).json({
        success: false,
        message: "Le fichier 'Etat des encaissements' est requis.",
      });
    }

    // ── 1. Extraction des encaissements ───────────────────────────
    console.log('[rapportController] Analyse encaissements...');
    const dataEnc = await analyserSituationEncaissements(fichierEncaissements.buffer);

    if (!dataEnc || !dataEnc.date_rapport) {
      return res.status(422).json({
        success: false,
        message: "Impossible d'extraire la date du PDF. Vérifiez que c'est un PDF natif ORASS (pas imprimé).",
      });
    }

    // ── 2. Extraction du bordereau commissions (optionnel) ────────
    let dataComm = null;
    if (fichierCommissions) {
      console.log('[rapportController] Analyse commissions...');
      dataComm = await analyserBordereauCommissions(fichierCommissions.buffer);
    }

    const dateRapport = dataEnc.date_rapport;

    // ── 3. Solde initial = solde final du dernier rapport ─────────
    const veille = await rapportService.getSoldeFinalVeille(dateRapport);
    const soldeInitialEspeces = Number(veille?.solde_final_especes ?? 0);
    const soldeInitialCheques = Number(veille?.solde_final_cheques ?? 0);

    if (veille) {
      console.log(`[rapportController] Solde récupéré depuis le ${veille.date_rapport} : ${soldeInitialEspeces} FCFA`);
    } else {
      console.log('[rapportController] Aucun rapport précédent — solde initial = 0');
    }

    // ── 4. Sauvegarde en BDD ──────────────────────────────────────
    const { id_rapport, solde_final_especes } = await rapportService.sauvegarderRapport({
      date_rapport:              dateRapport,
      sur_emission_especes:      dataEnc.sur_emission   || 0,  // ESP + REGL (ristournes incluses)
      sur_emission_electronique: dataEnc.total_electronique || 0,
      total_versement_banque:    dataEnc.total_versement_banque || 0,
      commissions_payees:        dataComm?.total_a_regler  || 0,
      numero_bordereau:          dataComm?.numero_bordereau || null,
      solde_initial_especes:     soldeInitialEspeces,
      solde_initial_cheques:     soldeInitialCheques,
    }, idEmploye);

    console.log(`[rapportController] ✅ Rapport ${dateRapport} sauvegardé (id=${id_rapport})`);

    return res.status(200).json({
      success: true,
      date_rapport: dateRapport,
      id_rapport,
      extraction: {
        total_especes:         dataEnc.total_especes       || 0,
        total_regl_espece:     dataEnc.total_regl_espece   || 0,
        sur_emission:          dataEnc.sur_emission        || 0,
        total_electronique:    dataEnc.total_electronique  || 0,
        total_versement_banque:dataEnc.total_versement_banque || 0,
        total_general:         dataEnc.total_general       || 0,
        commissions_payees:    dataComm?.total_a_regler    || 0,
        numero_bordereau:      dataComm?.numero_bordereau  || null,
        solde_initial:         soldeInitialEspeces,
        solde_final:           solde_final_especes,
      },
      message: `Rapport du ${dateRapport} scanné et enregistré.`,
    });

  } catch (err) {
    console.error('[rapportController] Erreur scan :', err.message);
    return res.status(500).json({ success: false, message: 'Erreur interne.', error: err.message });
  }
}

// ── GET /api/rapport-journalier?date=YYYY-MM-DD ───────────────────────────────
async function getRapportJournalier(req, res) {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: "Paramètre 'date' requis." });

    const rapport = await rapportService.getRapportParDate(date);
    return res.status(200).json({ success: true, rapport: rapport || null });
  } catch (err) {
    console.error('[rapportController] Erreur get :', err.message);
    return res.status(500).json({ success: false, message: 'Erreur interne.' });
  }
}

// ── PATCH /api/rapport-journalier/:date ───────────────────────────────────────
async function mettreAJourRapport(req, res) {
  try {
    const idEmploye = req.user?.id;
    const { date }  = req.params;
    const result    = await rapportService.mettreAJourLigneManuelle(date, req.body, idEmploye);
    return res.status(200).json({ success: true, ...result, message: 'Rapport mis à jour.' });
  } catch (err) {
    console.error('[rapportController] Erreur update :', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/rapport-journalier/export?date=YYYY-MM-DD ───────────────────────
async function exporterRapportExcel(req, res) {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: "Paramètre 'date' requis." });

    const r = await rapportService.getRapportParDate(date);
    if (!r) return res.status(404).json({ success: false, message: 'Rapport introuvable pour cette date.' });

    const N = v => Number(v || 0);

    const esp       = N(r.sur_emission_especes);
    const elec      = N(r.sur_emission_electronique);
    const surEmission = esp + elec;
    const sp        = N(r.solde_initial_especes);
    const sc        = N(r.solde_initial_cheques);
    const com       = N(r.commissions_payees);
    const ade       = N(r.autres_depenses);
    const vb        = N(r.versement_banque);
    const vc        = N(r.versement_compta);
    const sf_esp    = N(r.solde_final_especes);
    const sf_chq    = N(r.solde_final_cheques);

    const dateFormatee = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });

    // ── Styles ───────────────────────────────────────────────────
    const gris  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    const jaune = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE066' } };
    const bold  = { bold: true };
    const center = { horizontal: 'center', vertical: 'middle' };
    const numFmt = '#,##0';

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rapport journalier');

    // Largeurs
    ws.getColumn(1).width = 44;
    ws.getColumn(2).width = 16; // ESPECES
    ws.getColumn(3).width = 16; // CHEQUES / ELEC
    ws.getColumn(4).width = 20; // COMP/REGUL
    ws.getColumn(5).width = 16; // ENC DEPLACE
    ws.getColumn(6).width = 16; // VIREMENT
    ws.getColumn(7).width = 16; // TOTAUX
    ws.getColumn(8).width = 24; // OBSERVATION

    // Helper écriture ligne
    const writeRow = (rowNum, vals, opts = {}) => {
      const row = ws.getRow(rowNum);
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        if (i > 0 && typeof v === 'number') cell.numFmt = numFmt;
        if (opts.bold)  cell.font  = bold;
        if (opts.fill)  cell.fill  = opts.fill;
        if (opts.align) cell.alignment = opts.align;
      });
      if (opts.height) row.height = opts.height;
    };

    let rowNum = 1;

    // ── Titre bureau ─────────────────────────────────────────────
    ws.mergeCells(`A${rowNum}:H${rowNum}`);
    Object.assign(ws.getCell(`A${rowNum}`), {
      value: 'CAISSE RECETTES BONAMOUSSADI',
      font: { bold: true, size: 13 }, alignment: center, fill: gris,
    });
    ws.getRow(rowNum).height = 22;

    rowNum++;
    ws.mergeCells(`A${rowNum}:H${rowNum}`);
    Object.assign(ws.getCell(`A${rowNum}`), {
      value: `Journée du ${dateFormatee}`,
      font: { bold: true, size: 12 }, alignment: center,
    });
    ws.getRow(rowNum).height = 20;

    rowNum += 2; // ligne vide

    // ── Section ACTIVITES ─────────────────────────────────────────
    ws.mergeCells(`A${rowNum}:H${rowNum}`);
    Object.assign(ws.getCell(`A${rowNum}`), {
      value: 'ACTIVITES DE LA JOURNEE', font: bold, fill: gris, alignment: center,
    });
    ws.getRow(rowNum).height = 18;

    rowNum++;
    writeRow(rowNum,
      ['', 'PRODUCTIONS', 'ENCAISSEMENTS', 'ECART', '', '', '', 'OBSERVATIONS'],
      { bold: true, fill: gris, align: center }
    );

    const activites = [
      ['EMISSIONS HORS POOL TPV', surEmission, surEmission, 0],
      ['EMISSIONS POOL TPV',       0, 0, 0],
      ['COURTAGE',                 0, 0, 0],
      ['DEPOT CLIENTS',            0, 0, 0],
      ['RECOUVREMENT',             0, 0, 0],
      ['VERSEMENT EN REMPLACEMENT DE CHEQUES', '', '', 0],
      ['TOTAL', surEmission, surEmission, 0],
    ];
    activites.forEach(([label, prod, enc, ecart]) => {
      rowNum++;
      const isTotal = label === 'TOTAL';
      writeRow(rowNum, [label, prod, enc, ecart, '', '', '', ''],
        { bold: isTotal, fill: isTotal ? gris : undefined });
    });

    rowNum += 2; // ligne vide

    // ── En-têtes grille principale ────────────────────────────────
    writeRow(rowNum,
      ['', 'ESPECES', 'CHEQUES', 'COMP/REGUL/ATTEST', 'ENC DEPLACE', 'VIREMENT', 'TOTAUX', 'OBSERVATION'],
      { bold: true, fill: gris, align: center }
    );

    // ── Données grille ────────────────────────────────────────────
    const lignes = [
      { label: 'SUR EMISSIONS',
        v: [esp, elec, 0, 0, 0, surEmission], bold: false },
      { label: 'POOL TPV',
        v: [0, 0, 0, 0, 0, 0], bold: false },
      { label: 'HORS ORASS',
        v: [0, 0, 0, 0, 0, 0], bold: false },
      { label: 'COURTAGE',
        v: [0, 0, 0, 0, 0, 0], bold: false },
      { label: 'DEPOTS CLIENTS',
        v: [0, 0, 0, 0, 0, 0], bold: false },
      { label: 'TOTAUX',
        v: [esp, elec, 0, 0, 0, surEmission], bold: true, fill: gris },
      { label: 'REMBST CLIENTS/AVENANT',
        v: [0, 0, 0, 0, 0, 0], bold: false },
      { label: 'ENCAISSEMENTS NETS (5) - (6)',
        v: [esp, elec, 0, 0, 0, surEmission], bold: true, fill: gris },
      { label: "SOLDE INITIAL (à l'ouverture)",
        v: [sp, sc, 0, 0, 0, sp + sc], bold: false },
      { label: 'COMISSIONS PAYEES',
        v: [com, 0, 0, 0, 0, com], bold: false },
      { label: 'AUTRES DEPENSES ()',
        v: [ade, 0, 0, 0, 0, ade], bold: false },
      { label: 'VERSEMENTS à la BANQUE',
        v: [vb, 0, 0, 0, 0, vb], bold: false },
      { label: 'VERSEMENTS à la Comptabilité',
        v: [vc, 0, 0, 0, 0, vc], bold: false },
      { label: 'SOLDE FINAL (à la fermeture)[(7)+(8)]-[(9)+(10)]',
        v: [sf_esp, sf_chq, 0, 0, 0, sf_esp + sf_chq], bold: true, fill: jaune },
    ];

    lignes.forEach(l => {
      rowNum++;
      writeRow(rowNum, [l.label, ...l.v, ''], { bold: l.bold, fill: l.fill });
    });

    // ── Observations et signatures ────────────────────────────────
    rowNum += 2;
    ws.getRow(rowNum).getCell(1).value =
      'Autres remarques/explication (Responsable de la production)';
    if (r.observations) {
      rowNum++;
      ws.getRow(rowNum).getCell(1).value = r.observations;
    }
    rowNum += 2;
    ws.getRow(rowNum).getCell(1).value = 'La caisse';
    ws.getRow(rowNum).getCell(3).value = "Chef d'agence";
    ws.getRow(rowNum).getCell(6).value = 'Direction Administratif';

    // ── Envoi ─────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=rapport_journalier_${date}.xlsx`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('[rapportController] Erreur export :', err.message);
    return res.status(500).json({ success: false, message: "Erreur lors de l'export Excel." });
  }
}

module.exports = {
  scannerRapportJournalier,
  getRapportJournalier,
  mettreAJourRapport,
  exporterRapportExcel,
};