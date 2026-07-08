// controllers/productionController.js
const ExcelJS = require('exceljs');
const productionService = require('../services/productionService');

// Calcule les dates lundi-dimanche à partir d'une chaîne "2026-W20" (format input type="week")
function getDatesSemaine(semaineISO) {
  const [annee, semaine] = semaineISO.split('-W').map(Number);
  const janvier4 = new Date(annee, 0, 4);
  const jourSemaineJanvier4 = janvier4.getDay() || 7;
  const lundiSemaine1 = new Date(janvier4);
  lundiSemaine1.setDate(janvier4.getDate() - jourSemaineJanvier4 + 1);

  const lundi = new Date(lundiSemaine1);
  lundi.setDate(lundiSemaine1.getDate() + (semaine - 1) * 7);

  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);

  // Formatage en local (PAS toISOString, qui convertit en UTC et peut décaler d'un jour)
  const formatDate = (d) => {
    const annee = d.getFullYear();
    const mois = String(d.getMonth() + 1).padStart(2, '0');
    const jour = String(d.getDate()).padStart(2, '0');
    return `${annee}-${mois}-${jour}`;
  };
  return { debut: formatDate(lundi), fin: formatDate(dimanche) };
}

function formatLigne(row) {
  return {
    numero_police: row.numero_police,
    nom_prenom: row.nom_prenom.trim(),
    date_emission: row.date_emission ? new Date(row.date_emission).toLocaleDateString('fr-FR') : '-',
    date_effet: row.date_effet ? new Date(row.date_effet).toLocaleDateString('fr-FR') : '-',
    date_echeance: row.date_echeance ? new Date(row.date_echeance).toLocaleDateString('fr-FR') : '-',
    num_carte_rose: row.num_carte_rose || '-',
    num_attestation: row.num_attestation || '-',
    tva: row.tva || 0,
    carte_rose: row.montant_carte_rose || 0,
    prime_totale: row.prime_totale || 0,
    observation: '',
  };
}

function formaterDateFr(dateISO) {
  const [annee, mois, jour] = dateISO.split('-');
  return `${jour}/${mois}/${annee}`;
}

// GET /api/production/semaine?semaine=2026-W20
async function getProductionSemaine(req, res) {
  try {
    const { semaine } = req.query;
    if (!semaine) {
      return res.status(400).json({ success: false, message: "Paramètre 'semaine' requis (ex: 2026-W20)." });
    }

    const { debut, fin } = getDatesSemaine(semaine);
    const rows = await productionService.getProductionParSemaine(debut, fin);

    return res.status(200).json({
      success: true,
      periode: { debut, fin },
      lignes: rows.map(formatLigne),
    });
  } catch (error) {
    console.error('[productionController] Erreur :', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors du chargement.' });
  }
}

// GET /api/production/export?semaine=2026-W20
async function exporterProductionExcel(req, res) {
  try {
    const { semaine } = req.query;
    if (!semaine) {
      return res.status(400).json({ success: false, message: "Paramètre 'semaine' requis." });
    }

    const { debut, fin } = getDatesSemaine(semaine);
    const rows = await productionService.getProductionParSemaine(debut, fin);
    const lignes = rows.map(formatLigne);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Production');

    const colonnes = [
      { header: 'Numero police',     key: 'numero_police',     width: 20 },
      { header: 'Nom et Prenom',     key: 'nom_prenom',        width: 25 },
      { header: "Date d'emission",   key: 'date_emission',     width: 15 },
      { header: 'Date effet',        key: 'date_effet',        width: 15 },
      { header: 'Date echeance',     key: 'date_echeance',     width: 15 },
      { header: 'Num Carte rose',    key: 'num_carte_rose',    width: 16 },
      { header: 'Num Attestation',   key: 'num_attestation',   width: 16 },
      { header: 'TVA',               key: 'tva',               width: 12 },
      { header: 'Carte rose',        key: 'carte_rose',        width: 12 },
      { header: 'Prime totale',      key: 'prime_totale',      width: 14 },
      { header: 'Observation',       key: 'observation',       width: 16 },
    ];

    // Ligne de titre au-dessus du tableau (ligne 1), fusionnée sur toutes les colonnes
    sheet.mergeCells(1, 1, 1, colonnes.length);
    const celluleTitre = sheet.getCell('A1');
    celluleTitre.value = `Rapport de production du ${formaterDateFr(debut)} au ${formaterDateFr(fin)}`;
    celluleTitre.font = { bold: true, size: 13 };
    celluleTitre.alignment = { horizontal: 'center', vertical: 'middle' };
    celluleTitre.fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' }
    };
    sheet.getRow(1).height = 24;

    // Ligne vide de séparation (ligne 2)
    sheet.addRow([]);

    // En-têtes du tableau (ligne 3)
    const ligneEntetes = sheet.addRow(colonnes.map((c) => c.header));
    ligneEntetes.font = { bold: true };

    // Applique le gris uniquement aux colonnes qui seront remplies (pas "Observation")
    colonnes.forEach((col, i) => {
      if (col.key === 'observation') return; // colonne vide, pas de couleur
      const cellule = ligneEntetes.getCell(i + 1);
      cellule.fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' }
      };
    });

    // Applique les clés/largeurs de colonnes (sans réécrire les en-têtes, déjà mis manuellement)
    colonnes.forEach((col, i) => {
      sheet.getColumn(i + 1).key = col.key;
      sheet.getColumn(i + 1).width = col.width;
    });

    lignes.forEach((ligne) => sheet.addRow(colonnes.map((c) => ligne[c.key])));

    sheet.getColumn('tva').numFmt = '#,##0';
    sheet.getColumn('carte_rose').numFmt = '#,##0';
    sheet.getColumn('prime_totale').numFmt = '#,##0';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=production_${debut}_${fin}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('[productionController] Erreur export :', error.message);
    return res.status(500).json({ success: false, message: "Erreur serveur lors de l'export." });
  }
}

module.exports = { getProductionSemaine, exporterProductionExcel };