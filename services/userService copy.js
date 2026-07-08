const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const CLIENT_SELECT = `
  SELECT
    c.id_utilisateur AS id,
    c.nom,
    c.prenom,
    c.identifiant AS email,
    c.telephone_whatsapp AS tel,
    c.mdp AS mot_de_passe,
    u.libelle AS role
  FROM client c
  INNER JOIN utilisateur u ON u.id_utilisateur = c.id_utilisateur
`;

async function findByEmailAndTel(email, tel) {
  const [rows] = await pool.query(
    `${CLIENT_SELECT} WHERE c.identifiant = ? AND c.telephone_whatsapp = ? LIMIT 1`,
    [email.trim(), tel.trim()]
  );
  return rows[0] || null;
}

async function findByEmail(email) {
  const [rows] = await pool.query(
    `${CLIENT_SELECT} WHERE c.identifiant = ? LIMIT 1`,
    [email.trim()]
  );
  return rows[0] || null;
}

async function createUser(userData) {
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [utilisateurResult] = await connection.query(
      'INSERT INTO utilisateur (libelle) VALUES (?)',
      [userData.role || 'client']
    );

    const idUtilisateur = utilisateurResult.insertId;

    await connection.query(
      `INSERT INTO client (id_utilisateur, nom, prenom, telephone_whatsapp, identifiant, mdp, date_inscription,adresse,sexe)
       VALUES (?, ?, ?, ?, ?, ?, CURDATE(),?,?)`,
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
