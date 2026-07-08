const pool = require('../config/db');
const bcrypt = require('bcryptjs');

async function afficherProfil_employe({idClient}){
    const [result] = await pool.query("SELECT nom,prenom,identifiant,adresse,sexe,adresse FROM employe WHERE id_utilisateur = ?",
        [idClient]
    )

    return result[0];
}


async function enregistrer_modifications_employe({idClient}, form){
    const nom = form.nom_profil;
    const prenom = form.prenom_profil;
    const identifiant = form.identifiant_profil;
    const mdp = form.mot_de_passe_profil;
    const adresse = form.adresse_profil;
    const sexe = form.sexe_profil;

    // HACHAGE DU MOT DE PASSE 

    const hashedPassword = await bcrypt.hash(mdp, 10);

    // Si un nouveau mot de passe est fourni, on met à jour le MDP aussi
    if (mdp && mdp.trim() !== "") {
        const [response] = await pool.query(
            "UPDATE employe SET nom = ?, prenom = ?, identifiant = ?, mdp = ? adresse = ?, sexe = ? WHERE id_utilisateur = ?",
            [nom, prenom, identifiant, hashedPassword, adresse, sexe, idClient]
        );
        return response;
    } else {
        // Sinon, on ne touche pas au mot de passe existant
        const [response] = await pool.query(
            "UPDATE employe SET nom = ?, prenom = ?, identifiant = ?, adresse = ?, sexe = ? WHERE id_utilisateur = ?",
            [nom, prenom, identifiant,adresse, sexe, idClient]
        );
        return response;
    }
}

module.exports = {
    afficherProfil_employe,
    enregistrer_modifications_employe,
}