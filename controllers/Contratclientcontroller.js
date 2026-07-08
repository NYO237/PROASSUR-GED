// controllers/contratClientController.js
const pool = require('../config/db');
const contratClientService = require('../services/contratClientService');

function formaterContrat(row) {
  return {
    id_document: row.id_document,
    numero_bureau: row.code_bureau,
    numero_police: row.num_police,
    numero_carte_rose: row.num_carte_rose || '-',
    vehicule: `${row.marque || ''} ${row.modele || ''}`.trim() || '-',
    immatriculation: row.immatriculation || '-',
    date_emission: row.date_emission ? new Date(row.date_emission).toLocaleDateString('fr-FR') : '-',
    date_effet: row.date_effet ? new Date(row.date_effet).toLocaleDateString('fr-FR') : '-',
    date_echeance: row.date_echeance ? new Date(row.date_echeance).toLocaleDateString('fr-FR') : '-',
    accessoires: row.accessoires || 0,
    prime_totale: row.prime_totale || 0,
    statut: row.statut_calcule,
  };
}

// Détermine le palier d'urgence à partir du nombre de jours restants
// (même règle que notificationsController, côté employé)
function calculerPalier(joursRestants) {
  if (joursRestants < 0) return 'expire';
  if (joursRestants <= 7) return 'J-7';
  if (joursRestants <= 14) return 'J-14';
  return 'J-30';
}

// GET /api/contrats/mes_contrats
async function afficherMesContrats(req, res) {
  try {
    // Le client connecté est identifié via req.user.id (JWT), on récupère son nom/prénom
    const [clientRows] = await pool.query(
      `SELECT nom, prenom FROM client WHERE id_utilisateur = ?`,
      [req.user.id]
    );

    if (clientRows.length === 0) {
      return res.status(404).json({ success: false, message: "Client introuvable." });
    }

    const { nom, prenom } = clientRows[0];
    const rows = await contratClientService.getContratsClient(nom, prenom);
    const contrats = rows.map(formaterContrat);

    return res.status(200).json({
      success: true,
      contrats_en_cours: contrats.filter(c => c.statut === 'en_cours'),
      contrats_expires: contrats.filter(c => c.statut === 'expire'),
      contrats_en_attente: contrats.filter(c => c.statut === 'en_attente_effet'),
    });

  } catch (error) {
    console.error('Erreur afficherMesContrats :', error);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des contrats.",
    });
  }
}

// GET /api/contrats/mes_notifications
async function afficherMesNotifications(req, res) {
  try {
    // Comme pour afficherMesContrats : on identifie le client connecté via
    // req.user.id (JWT), jamais via une valeur envoyée par le client, pour
    // qu'il ne puisse récupérer que SES PROPRES alertes.
    const [clientRows] = await pool.query(
      `SELECT nom, prenom FROM client WHERE id_utilisateur = ?`,
      [req.user.id]
    );

    if (clientRows.length === 0) {
      return res.status(404).json({ success: false, message: "Client introuvable." });
    }

    const { nom, prenom } = clientRows[0];
    const alertes = await contratClientService.getAlertesContratsClient(nom, prenom);

    const notifications = alertes.map((a) => ({
      id_document: a.id_document,
      code_bureau: a.code_bureau,
      num_police: a.num_police,
      date_echeance: a.date_echeance,
      jours_restants: a.jours_restants,
      palier: calculerPalier(a.jours_restants),
      vehicule: {
        id_vehicule: a.id_vehicule,
        immatriculation: a.immatriculation,
        marque: a.marque,
        modele: a.modele,
      },
    }));

    return res.status(200).json({
      success: true,
      total: notifications.length,
      notifications,
    });

  } catch (error) {
    console.error('Erreur afficherMesNotifications :', error);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des notifications.",
    });
  }
}

module.exports = { afficherMesContrats, afficherMesNotifications };