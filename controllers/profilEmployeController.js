const profilService = require('../services/ProfilEmployeService');
const statsService = require('../services/StatsEmployeService');

async function afficher_infos_employe(req, res) {
    try {
        // req.user.id vient de ton middleware authMiddleware
        const user = await profilService.afficherProfil_employe({ idClient: req.user.id });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur non trouvé."
            });
        }

        return res.status(200).json({
            success: true,
            user: user,
        });
    } catch (error) {
        console.error("Erreur dans afficher_infos :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la récupération du profil."
        });
    }
}



async function enregistrer_modification_employe(req,res) {
    try{
        const response = await profilService.enregistrer_modifications_employe({idClient : req.user.id},req.body);


        return res.status(200).json({
            success : true,
            message : "Modification appliquees avec succes !"
        })

    }catch(error){
        console.log("Erreur lors de la modification du profil : " + error);
        res.status(400).json({
            success : false,
            message : "Erreur serveur lors de la modification du profil"
        })
    }
}

async function afficher_statistiques_employe(req, res) {
    try {
        const statistiques = await statsService.recupererStatistiquesEmploye(req.user.id);

        return res.status(200).json({
            success: true,
            statistiques,
        });
    } catch (error) {
        console.error("Erreur dans afficher_statistiques_employe :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la récupération des statistiques."
        });
    }
}

module.exports = {
    afficher_infos_employe,
    enregistrer_modification_employe,
    afficher_statistiques_employe,
};