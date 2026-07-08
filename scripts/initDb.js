const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function initDb() {
  const sqlPath = path.join(__dirname, '..', 'db.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const statements = sql
    .split(';')
    .map((s) => s.replace(/--.*$/gm, '').trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await pool.query(statement);
  }

  console.log('Base de données initialisée avec succès.');
  await pool.end();
}

initDb().catch((error) => {
  console.error('Erreur initialisation BDD :', error.message);
  process.exit(1);
});
