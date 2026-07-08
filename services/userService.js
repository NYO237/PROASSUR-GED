const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// Requête pour chercher un client
const CLIENT_SELECT = `
  SELECT
    c.id_utilisateur AS id,
    c.nom,
    c.prenom,
    c.sexe,
    c.identifiant AS email,
    c.telephone_whatsapp AS tel,
    c.mdp AS mot_de_passe,
    u.libelle AS role,
    u.status AS statut_compte,
    0 AS est_chef_agence
  FROM client c
  INNER JOIN utilisateur u ON u.id_utilisateur = c.id_utilisateur
  WHERE c.identifiant = ? LIMIT 1
`;

// Requête pour chercher un employé (le téléphone est désormais obligatoire, comme pour le client)
// Le LEFT JOIN sur chef_agence permet de savoir si cet employé a les droits de chef d'agence
const EMPLOYE_SELECT = `
  SELECT
    e.id_utilisateur AS id,
    e.nom,
    e.prenom,
    e.sexe,
    e.identifiant AS email,
    e.telephone_whatsapp AS tel,
    e.mdp AS mot_de_passe,
    u.libelle AS role,
    u.status AS statut_compte,
    (ca.id_utilisateur IS NOT NULL) AS est_chef_agence
  FROM employe e
  INNER JOIN utilisateur u ON u.id_utilisateur = e.id_utilisateur
  LEFT JOIN chef_agence ca ON ca.id_utilisateur = e.id_utilisateur
  WHERE e.identifiant = ? LIMIT 1
`;

// 1. Chercher d'abord chez les clients, puis chez les employés
async function findByEmail(email) {
  // 1. On cherche d'abord dans les clients
  const [clientRows] = await pool.query(CLIENT_SELECT, [email.trim()]);
  if (clientRows.length > 0) {
    return clientRows[0];
  }

  // 2. Si on ne trouve rien, on cherche dans les employés !
  const [employeRows] = await pool.query(EMPLOYE_SELECT, [email.trim()]);
  if (employeRows.length > 0) {
    return employeRows[0];
  }

  // 3. Si aucun des deux n'existe
  return null;
}

// 2. Vérifie le couple Email/Tel. Le téléphone est désormais obligatoire pour
// TOUS les rôles (client ET employé) : plus d'exception pour les employés.
async function findByEmailAndTel(email, tel) {
  const user = await findByEmail(email);
  if (!user) return null;

  if (!tel || !user.tel || user.tel !== tel.trim()) {
    return null; // Téléphone manquant ou incorrect
  }

  return user;
}

async function createUser(userData) {
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // L'inscription reste exclusive aux clients d'après votre consigne
    const [utilisateurResult] = await connection.query(
      'INSERT INTO utilisateur (libelle) VALUES (?)',
      ['client'] 
    );

    const idUtilisateur = utilisateurResult.insertId;

    await connection.query(
      `INSERT INTO client (id_utilisateur, nom, prenom, telephone_whatsapp, identifiant, mdp, date_inscription, adresse, sexe)
       VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, ?)`,
      [
        idUtilisateur,
        userData.nom.trim(),
        userData.prenom.trim(),
        userData.tel.trim(),
        userData.email.trim(),
        hashedPassword,
        userData.adresse.trim(),
        userData.sexe.trim(),
      ]
    );

    await connection.commit();
    return idUtilisateur;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

function getRedirectByRole(role) {
  return role === 'employe' ? '/demandes_recues' : '/accueil';
}

module.exports = {
  findByEmailAndTel,
  findByEmail,
  createUser,
  verifyPassword,
  getRedirectByRole,
};