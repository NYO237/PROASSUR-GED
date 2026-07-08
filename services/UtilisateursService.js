const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// ─── Affichage ────────────────────────────────────────────────────────────────

async function afficherClients() {
    const [result] = await pool.query(
        `SELECT c.id_utilisateur, c.nom, c.prenom, c.telephone_whatsapp,
                c.identifiant, c.adresse, c.sexe, u.status
         FROM client c
         JOIN utilisateur u ON u.id_utilisateur = c.id_utilisateur`
    );
    return result;
}

async function afficherEmployes() {
    const [result] = await pool.query(
        `SELECT e.id_utilisateur, e.nom, e.prenom, e.identifiant, e.telephone_whatsapp,e.adresse, u.status,
                (ca.id_utilisateur IS NOT NULL) AS est_chef_agence
         FROM employe e
         JOIN utilisateur u ON u.id_utilisateur = e.id_utilisateur
         LEFT JOIN chef_agence ca ON ca.id_utilisateur = e.id_utilisateur`
    );
    return result;
}

// ─── Suppression ──────────────────────────────────────────────────────────────
// Supprime dans la table utilisateur : le ON DELETE CASCADE supprime automatiquement
// la ligne correspondante dans client ou employe.

async function supprimerUtilisateur(idUtilisateur) {
    const [result] = await pool.query(
        "DELETE FROM utilisateur WHERE id_utilisateur = ?",
        [idUtilisateur]
    );
    return result;
}

// ─── Suspension / réactivation ────────────────────────────────────────────────

async function getStatusActuel(idUtilisateur) {
    const [rows] = await pool.query(
        "SELECT status FROM utilisateur WHERE id_utilisateur = ?",
        [idUtilisateur]
    );
    return rows[0]?.status || null;
}

async function basculerStatus(idUtilisateur) {
    const statusActuel = await getStatusActuel(idUtilisateur);
    if (!statusActuel) return null;

    const nouveauStatus = statusActuel === 'actif' ? 'suspendu' : 'actif';

    await pool.query(
        "UPDATE utilisateur SET status = ? WHERE id_utilisateur = ?",
        [nouveauStatus, idUtilisateur]
    );

    return nouveauStatus;
}

// ─── Création ──────────────────────────────────────────────────────────────────
// Crée d'abord la ligne "utilisateur" (rôle + statut), puis la ligne spécifique
// dans client ou employe, dans une même transaction (annulation si une étape échoue).

async function creerUtilisateur(roleType, donnees) {
    const { nom, prenom, identifiant, mot_de_passe, telephone_whatsapp, adresse, sexe, estChefAgence } = donnees;

    if (!mot_de_passe || mot_de_passe.trim() === '') {
        const erreur = new Error("Le mot de passe est obligatoire à la création.");
        erreur.code = 'MDP_REQUIS';
        throw erreur;
    }
    // Le téléphone WhatsApp est désormais obligatoire pour TOUS les rôles
    // (la colonne employe.telephone_whatsapp est NOT NULL depuis la migration chef_agence)
    if (!telephone_whatsapp || telephone_whatsapp.trim() === '') {
        const erreur = new Error("Le téléphone WhatsApp est obligatoire.");
        erreur.code = 'TELEPHONE_REQUIS';
        throw erreur;
    }

    const mdpHash = await bcrypt.hash(mot_de_passe, 10);
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [resultUtilisateur] = await connection.query(
            "INSERT INTO utilisateur (libelle, status) VALUES (?, 'actif')",
            [roleType]
        );
        const idUtilisateur = resultUtilisateur.insertId;

        if (roleType === 'client') {
            await connection.query(
                `INSERT INTO client (id_utilisateur, nom, prenom, telephone_whatsapp, identifiant, mdp, date_inscription, sexe, adresse)
                 VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, ?)`,
                [idUtilisateur, nom, prenom || null, telephone_whatsapp, identifiant, mdpHash, sexe || null, adresse || null]
            );
        } else if (roleType === 'employe') {
            await connection.query(
                `INSERT INTO employe (id_utilisateur, nom, prenom, telephone_whatsapp, identifiant, mdp)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [idUtilisateur, nom, prenom || null, telephone_whatsapp, identifiant, mdpHash]
            );

            // Si la case "Chef d'agence" est cochée, on ajoute le marqueur correspondant
            if (estChefAgence) {
                await connection.query(
                    "INSERT INTO chef_agence (id_utilisateur) VALUES (?)",
                    [idUtilisateur]
                );
            }
        } else {
            throw new Error("Type de rôle invalide (attendu: 'client' ou 'employe').");
        }

        await connection.commit();
        return idUtilisateur;

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// ─── Modification ─────────────────────────────────────────────────────────────
// roleType permet de savoir dans quelle table (client ou employe) écrire les champs spécifiques.

async function modifierUtilisateur(idUtilisateur, roleType, donnees) {
    const { nom, prenom, identifiant, adresse, sexe, mot_de_passe, telephone_whatsapp, estChefAgence } = donnees;

    let mdpHash = null;
    if (mot_de_passe && mot_de_passe.trim() !== '') {
        mdpHash = await bcrypt.hash(mot_de_passe, 10);
    }

    if (roleType === 'client') {
        const champs = ['nom = ?', 'prenom = ?', 'identifiant = ?', 'adresse = ?', 'sexe = ?'];
        const valeurs = [nom, prenom, identifiant, adresse || null, sexe || null];

        if (telephone_whatsapp && telephone_whatsapp.trim() !== '') {
            champs.push('telephone_whatsapp = ?');
            valeurs.push(telephone_whatsapp.trim());
        }
        if (mdpHash) {
            champs.push('mdp = ?');
            valeurs.push(mdpHash);
        }
        valeurs.push(idUtilisateur);

        await pool.query(
            `UPDATE client SET ${champs.join(', ')} WHERE id_utilisateur = ?`,
            valeurs
        );
    } else if (roleType === 'employe') {
        const champs = ['nom = ?', 'prenom = ?', 'identifiant = ?'];
        const valeurs = [nom, prenom, identifiant];

        if (telephone_whatsapp && telephone_whatsapp.trim() !== '') {
            champs.push('telephone_whatsapp = ?');
            valeurs.push(telephone_whatsapp.trim());
        }
        if (mdpHash) {
            champs.push('mdp = ?');
            valeurs.push(mdpHash);
        }
        valeurs.push(idUtilisateur);

        await pool.query(
            `UPDATE employe SET ${champs.join(', ')} WHERE id_utilisateur = ?`,
            valeurs
        );

        // Promotion / rétrogradation chef d'agence (si le champ a été envoyé par le front)
        if (typeof estChefAgence === 'boolean') {
            if (estChefAgence) {
                await pool.query(
                    "INSERT IGNORE INTO chef_agence (id_utilisateur) VALUES (?)",
                    [idUtilisateur]
                );
            } else {
                await pool.query(
                    "DELETE FROM chef_agence WHERE id_utilisateur = ?",
                    [idUtilisateur]
                );
            }
        }
    } else {
        throw new Error("Type de rôle invalide (attendu: 'client' ou 'employe').");
    }

    return true;
}

module.exports = {
    afficherClients,
    afficherEmployes,
    supprimerUtilisateur,
    basculerStatus,
    modifierUtilisateur,
    creerUtilisateur,
};