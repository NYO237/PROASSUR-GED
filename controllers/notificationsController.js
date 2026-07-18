// controllers/notificationsController.js
const notificationsService = require('../services/NotificationsService');

// Détermine le palier d'urgence d'un contrat à partir du nombre de jours restants
function calculerPalierContrat(joursRestants) {
  if (joursRestants < 0) return 'expire';
  if (joursRestants <= 7) return 'J-7';
  if (joursRestants <= 14) return 'J-14';
  return 'J-30';
}

// Détermine le palier d'urgence d'une demande à partir du nombre de minutes
// écoulées depuis sa création. Au-delà de SEUIL_URGENCE_MINUTES (4h par
// défaut), l'attente est jugée anormalement longue.
// -> Ce sous-palier est une amélioration ajoutée au-delà de la demande initiale
//    ("alerte après 2h") pour distinguer visuellement une attente encore
//    récente d'une attente qui traîne. Si vous préférez un seul type d'alerte
//    de demande, remplacez le corps de cette fonction par `return 'demande';`.
const SEUIL_URGENCE_MINUTES = 240; // 4h

function calculerPalierDemande(minutesEcoulees) {
  return minutesEcoulees >= SEUIL_URGENCE_MINUTES ? 'demande-urgente' : 'demande-attente';
}

async function listerNotifications(req, res) {
  try {
    const [alertesContrats, alertesDemandes] = await Promise.all([
      notificationsService.getAlertesContrats(),
      notificationsService.getAlertesDemandesNonTraitees(),
    ]);

    const notificationsContrats = alertesContrats.map((a) => ({
      type: 'contrat',
      id_document: a.id_document,
      code_bureau: a.code_bureau,
      num_police: a.num_police,
      date_echeance: a.date_echeance,
      jours_restants: a.jours_restants,
      palier: calculerPalierContrat(a.jours_restants),
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

    const notificationsDemandes = alertesDemandes.map((d) => ({
      type: 'demande',
      id_demande: d.id_demande,
      date_demande: d.date_demande,
      heure_demande: d.heure_demande,
      statut_demande: d.statut_demande,
      minutes_ecoulees: d.minutes_ecoulees,
      palier: calculerPalierDemande(d.minutes_ecoulees),
      client: {
        id_client: d.id_client,
        nom: d.nom_client,
        prenom: d.prenom_client,
        telephone: d.telephone_client,
      },
    }));

    const notifications = [...notificationsDemandes, ...notificationsContrats];

    return res.status(200).json({
      success: true,
      total: notifications.length,
      total_contrats: notificationsContrats.length,
      total_demandes: notificationsDemandes.length,
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