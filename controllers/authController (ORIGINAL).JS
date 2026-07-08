const { validateInscription, validateLogin } = require('../utils/validators');
const jwt = require('jsonwebtoken')
require('dotenv').config()
const userService = require('../services/userService');

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

    const validation = validateLogin({ email, tel, password });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Le formulaire contient des erreurs.',
        errors: validation.errors,
      });
    }

    const user = await userService.findByEmailAndTel(email, tel);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects.',
        errors: { global: 'Email, téléphone ou mot de passe incorrect.' },
      });
    }

    const passwordOk = await userService.verifyPassword(password, user.mot_de_passe);
    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects.',
        errors: { global: 'Email, téléphone ou mot de passe incorrect.' },
      });
    }
    // J'ai ajoute les tokens dans cette partie
          // 1. On récupère la clé du .env et on force les vrais sauts de ligne (\n)
          const privateKey = process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');

          // 2. On signe le token avec la clé nettoyée
          const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            privateKey, // On utilise la variable nettoyée ici
            { algorithm: 'RS256', expiresIn: '2h' }
          );
    // 
    


    return res.status(200).json({
      success: true,
      message: 'Connexion réussie.',
      token : token ,
      redirect: userService.getRedirectByRole(user.role),
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Erreur connexion :', error.message);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion.',
    });
  }
}

module.exports = {
  register,
  login,
};
