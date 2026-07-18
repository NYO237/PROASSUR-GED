const utilisateursService = require('../services/UtilisateursService');

async function afficher_infos_clients(req, res) {
    try {
        const users = await utilisateursService.afficherClients();

        if (!users) {
            return res.status(404).json({ success: false, message: "Utilisateurs non trouvés." });
        }

        return res.status(200).json({ success: true, users });
    } catch (error) {
        console.error("Erreur dans afficher_infos_clients :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la récupération des informations clients"
        });
    }
}

async function afficher_infos_employes(req, res) {
    try {
        const users = await utilisateursService.afficherEmployes();

        if (!users) {
            return res.status(404).json({ success: false, message: "Utilisateurs non trouvés." });
        }

        return res.status(200).json({ success: true, users });
    } catch (error) {
        console.error("Erreur dans afficher_infos_employes :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la recuperation des infos employes"
        });
    }
}

// DELETE /api/utilisateurs/supprimer/:id
async function supprimerUtilisateur(req, res) {
    try {
        const idUtilisateur = req.params.id;

        const response = await utilisateursService.supprimerUtilisateur(idUtilisateur);

        if (!response || response.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Aucun utilisateur trouvé à supprimer",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Utilisateur supprimé avec succès"
        });

    } catch (error) {
        console.error("Erreur dans utilisateursController - supprimerUtilisateur :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la suppression de l'utilisateur",
        });
    }
}

// PATCH /api/utilisateurs/basculer_status/:id
async function basculerStatus(req, res) {
    try {
        const idUtilisateur = req.params.id;

        const nouveauStatus = await utilisateursService.basculerStatus(idUtilisateur);

        if (!nouveauStatus) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur non trouvé.",
            });
        }

        return res.status(200).json({
            success: true,
            message: `Utilisateur ${nouveauStatus === 'suspendu' ? 'suspendu' : 'réactivé'} avec succès.`,
            status: nouveauStatus,
        });

    } catch (error) {
        console.error("Erreur dans utilisateursController - basculerStatus :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors du changement de statut.",
        });
    }
}

// POST /api/utilisateurs/creer
async function creerUtilisateur(req, res) {
    try {
        const { roleType, ...donnees } = req.body;

        if (!roleType || (roleType !== 'client' && roleType !== 'employe')) {
            return res.status(400).json({
                success: false,
                message: "Le type de rôle (client ou employe) est requis.",
            });
        }

        if (!donnees.nom || !donnees.identifiant || !donnees.mot_de_passe) {
            return res.status(400).json({
                success: false,
                message: "Nom, identifiant et mot de passe sont obligatoires.",
            });
        }

        if (!donnees.telephone_whatsapp) {
            return res.status(400).json({
                success: false,
                message: "Le téléphone WhatsApp est obligatoire.",
            });
        }

        const idUtilisateur = await utilisateursService.creerUtilisateur(roleType, donnees);

        return res.status(201).json({
            success: true,
            message: "Utilisateur créé avec succès.",
            id_utilisateur: idUtilisateur,
        });

    } catch (error) {
        console.error("Erreur dans utilisateursController - creerUtilisateur :", error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: "Cet identifiant est déjà utilisé par un autre utilisateur.",
            });
        }

        if (error.code === 'MDP_REQUIS' || error.code === 'TELEPHONE_REQUIS') {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la création de l'utilisateur.",
        });
    }
}

// PUT /api/utilisateurs/modifier/:id
async function modifierUtilisateur(req, res) {
    try {
        const idUtilisateur = req.params.id;
        const { roleType, ...donnees } = req.body;

        if (!roleType || (roleType !== 'client' && roleType !== 'employe')) {
            return res.status(400).json({
                success: false,
                message: "Le type de rôle (client ou employe) est requis.",
            });
        }

        if (!donnees.nom || !donnees.prenom || !donnees.identifiant) {
            return res.status(400).json({
                success: false,
                message: "Nom, prénom et identifiant sont obligatoires.",
            });
        }

        await utilisateursService.modifierUtilisateur(idUtilisateur, roleType, donnees);

        return res.status(200).json({
            success: true,
            message: "Utilisateur modifié avec succès.",
        });

    } catch (error) {
        console.error("Erreur dans utilisateursController - modifierUtilisateur :", error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: "Cet identifiant est déjà utilisé par un autre utilisateur.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la modification de l'utilisateur.",
        });
    }
}

// GET /api/utilisateurs/stats_client/:id
async function statistiquesClient(req, res) {
    try {
        const idUtilisateur = req.params.id;
        const stats = await utilisateursService.statistiquesClient(idUtilisateur);
        return res.status(200).json({ success: true, stats });
    } catch (error) {
        console.error("Erreur dans utilisateursController - statistiquesClient :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la récupération des statistiques du client.",
        });
    }
}

// GET /api/utilisateurs/stats_employe/:id
async function statistiquesEmploye(req, res) {
    try {
        const idUtilisateur = req.params.id;
        const stats = await utilisateursService.statistiquesEmploye(idUtilisateur);
        return res.status(200).json({ success: true, stats });
    } catch (error) {
        console.error("Erreur dans utilisateursController - statistiquesEmploye :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la récupération des statistiques de l'employé.",
        });
    }
}

module.exports = {
    afficher_infos_clients,
    afficher_infos_employes,
    supprimerUtilisateur,
    basculerStatus,
    modifierUtilisateur,
    creerUtilisateur,
    statistiquesClient,
    statistiquesEmploye,
};