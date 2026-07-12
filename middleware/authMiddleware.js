const jwt = require('jsonwebtoken');
require('dotenv').config();

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentification requise.' });
  }


  try {
    const publicKey = process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
    console.log('DEBUG clé publique — longueur:', publicKey ? publicKey.length : 'UNDEFINED');
    console.log('DEBUG clé publique — début:', publicKey ? JSON.stringify(publicKey.substring(0, 35)) : 'UNDEFINED');
    console.log('DEBUG clé publique — fin:', publicKey ? JSON.stringify(publicKey.substring(publicKey.length - 35)) : 'UNDEFINED');
    req.user = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Token invalide ou expiré.' });
  }
}

// Middleware à chaîner APRÈS authenticateToken sur les routes réservées aux chefs d'agence
// (ex: /api/utilisateurs). Un employé "simple" reçoit un 403.
function requireChefAgence(req, res, next) {
  if (req.user && req.user.role === 'employe' && req.user.estChefAgence) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: "Accès réservé aux chefs d'agence.",
  });
}

// Export rétrocompatible : `authenticateToken` reste directement importable et
// appelable comme avant (require('.../authMiddleware')), tout en exposant aussi
// requireChefAgence pour les nouvelles routes qui en ont besoin.
module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
module.exports.requireChefAgence = requireChefAgence;