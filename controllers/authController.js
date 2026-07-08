const { validateInscription, validateLogin } = require('../utils/validators');
const jwt = require('jsonwebtoken')
require('dotenv').config()
const userService = require('../services/UserService');

async function register(req, res) {
  try {
    const { nom, prenom, email, tel, password, adresse, sexe } = req.body;

    const validation = validateInscription({ nom, prenom, email, tel, password, adresse, sexe });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Le formulaire contient des erreurs.',
        errors: validation.errors,
      });
    }

    const existingUser = await userService.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Un compte existe déjà avec cet email.',
        errors: { email: 'Cet email est déjà utilisé.' },
      });
    }

    await userService.createUser({ nom, prenom, email, tel, password, adresse, sexe, role: 'client' });

    return res.status(201).json({
      success: true,
      message: 'Inscription réussie. Vous pouvez maintenant vous connecter.',
      redirect: '/connexion',
    });
  } catch (error) {
    console.error('Erreur inscription :', error.message);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'inscription.',
    });
  }
}

async function login(req, res) {
  try {
    const { email, tel, password } = req.body;

    // 1. On cherche l'utilisateur (client OU employé) en vérifiant Email + Téléphone
    // -> Le téléphone est désormais obligatoire pour tous les rôles, y compris employé.
    const user = await userService.findByEmailAndTel(email, tel);

    // 2. Si aucun utilisateur n'est trouvé (ou téléphone incorrect/manquant)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects.',
        errors: { global: 'Email, téléphone ou mot de passe incorrect.' },
      });
    }

    // 3. Si le compte a été suspendu par un administrateur, on bloque la connexion
    if (user.statut_compte === 'suspendu') {
      return res.status(403).json({
        success: false,
        message: 'Ce compte a été suspendu. Contactez un administrateur.',
        errors: { global: 'Compte suspendu.' },
      });
    }

    // 4. On vérifie si le mot de passe correspond
    const passwordOk = await userService.verifyPassword(password, user.mot_de_passe);
    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects.',
        errors: { global: 'Email, téléphone ou mot de passe incorrect.' },
      });
    }

    // 5. Génération du Token JWT (Sécurité)
    // On inclut estChefAgence pour permettre au front (et au middleware) de savoir
    // si cet employé a le droit d'accéder à la route /utilisateurs.
    const estChefAgence = !!user.est_chef_agence;
    const privateKey = process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
    const token = jwt.sign(
      {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        sexe: user.sexe,
        role: user.role,
        estChefAgence,
      },
      privateKey,
      { algorithm: 'RS256', expiresIn: '2h' }
    );

    // 6. Réponse positive et redirection selon le rôle
    return res.status(200).json({
      success: true,
      message: 'Connexion réussie.',
      token: token,
      redirect: userService.getRedirectByRole(user.role),
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        estChefAgence,
      },
    });

  } catch (error) {
    console.error('Erreur connexion serveur :', error.message);
    return res.status(500).json({
      success: false,
      message: 'Une erreur serveur est survenue.',
    });
  }
}

module.exports = {
  register,
  login,
};