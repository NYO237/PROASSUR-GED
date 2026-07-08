const pool = require('./config/db');
const bcrypt = require('bcryptjs');

async function repareEmploye() {
  try {
    // C'est Node.js qui va hacher proprement "123456789" (9 caractères)
    const nouveauHash = await bcrypt.hash('123456789', 10);
    
    console.log('Nouveau hash généré par le serveur :', nouveauHash);

    // On met à jour directement la base de données depuis le code
    await pool.query(
      "UPDATE employe SET mdp = ? WHERE identifiant = 'employe.test@proassur.com'",
      [nouveauHash]
    );

    console.log('✅ Le mot de passe de l\'employé a été mis à jour avec succès dans la BD !');
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors de la réparation :', error);
    process.exit(1);
  }
}

repareEmploye();