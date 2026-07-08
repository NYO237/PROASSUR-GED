// controllers/notificationsController.js
const notificationsService = require('../services/notificationsService');

// Détermine le palier d'urgence à partir du nombre de jours restants
function calculerPalier(joursRestants) {
  if (joursRestants < 0) return 'expire';
  if (joursRestants <= 7) return 'J-7';
  if (joursRestants <= 14) return 'J-14';
  return 'J-30';
}

async function listerNotifications(req, res) {
  try {
    const alertes = await notificationsService.getAlertesContrats();

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
      assure: {
        nom: a.nom_assure,
        prenom: a.prenom_assure,
      },
    }));

    return res.status(200).json({
      success: true,
      total: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error('Erreur dans notificationsController - listerNotifications :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des notifications.',
    });
  }
}

module.exports = { listerNotifications };