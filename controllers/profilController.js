const profilService = require('../services/ProfilService');

async function afficher_infos(req, res) {
    try {
        // req.user.id vient de ton middleware authMiddleware
        const user = await profilService.afficherProfil({ idClient: req.user.id });
        
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



async function enregistrer_modification(req,res) {
    try{
        const response = await profilService.enregistrer_modifications({idClient : req.user.id},req.body);


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

module.exports = {
    afficher_infos,
    enregistrer_modification,
};