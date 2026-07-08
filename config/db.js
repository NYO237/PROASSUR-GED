const mysql = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');
const path = require('path');


function cleanEnv(value) {
  if (!value) return '';
  return String(value).trim().replace(/;$/, '');
}

const caCertPath = path.join(__dirname, 'ca.pem');
const sslConfig = fs.existsSync(caCertPath)
  ? { ca: fs.readFileSync(caCertPath), rejectUnauthorized: true }
  : { rejectUnauthorized: true }; // fallback si le fichier n'est pas encore présent


function createDbPool() {
  const publicUrl = cleanEnv(process.env.DB_PUBLIC_URL);

  if (publicUrl) {
    const parsed = new URL(publicUrl);
    return mysql.createPool({
      host: parsed.hostname,
      port: Number(parsed.port) || 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      waitForConnections: true,
      connectionLimit: 10,
      ssl: sslConfig,
    });
  }

  return mysql.createPool({
    host: cleanEnv(process.env.DB_HOST),
    user: cleanEnv(process.env.DB_USER),
    password: cleanEnv(process.env.DB_PASSWORD),
    database: cleanEnv(process.env.DB_NAME),
    port: Number(cleanEnv(process.env.DB_PORT)) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    ssl: sslConfig,
  });
}

const pool = createDbPool();

module.exports = pool;
