const mysql = require('mysql2/promise');
require('dotenv').config();

function cleanEnv(value) {
  if (!value) return '';
  return String(value).trim().replace(/;$/, '');
}

function createDbPool() {
  const publicUrl = cleanEnv(process.env.DB_PUBLIC_URL);

  // mysql.railway.internal n'est résolvable que sur Railway : en local, utiliser l'URL publique
  if (!process.env.RAILWAY_ENVIRONMENT && publicUrl) {
    return mysql.createPool(publicUrl);
  }

  return mysql.createPool({
    host: cleanEnv(process.env.DB_HOST),
    user: cleanEnv(process.env.DB_USER),
    password: cleanEnv(process.env.DB_PASSWORD),
    database: cleanEnv(process.env.DB_NAME),
    port: Number(cleanEnv(process.env.DB_PORT)) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
  });
}

const pool = createDbPool();

module.exports = pool;
