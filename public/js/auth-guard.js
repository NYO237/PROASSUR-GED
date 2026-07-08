/**
 * auth-guard.js
 * -------------------------------------------------------------------------
 * Inclus en tout premier script du <head> de chaque page (déjà en place).
 *
 * Comme le token JWT vit dans le localStorage (pas dans un cookie), le
 * serveur Express ne peut pas le lire lors d'une navigation classique
 * (GET /demandes_recues, GET /utilisateurs, etc.). Le contrôle d'accès aux
 * PAGES se fait donc ici, côté client, avant que le contenu ne s'affiche.
 * Les API (/api/...) restent protégées côté serveur par authMiddleware.js.
 *
 * Ce script :
 *  1. Redirige vers /login si aucun token n'est présent, ou s'il est expiré.
 *  2. Empêche un client d'accéder aux pages employé, et inversement
 *     (fix de la faille : un client connecté ne peut plus ouvrir /demandes_recues,
 *     /utilisateurs, etc. en tapant l'URL).
 *  3. Réserve /utilisateurs aux employés qui sont chefs d'agence.
 *  4. Met à jour le badge #badge-statut-utilisateur avec le vrai statut
 *     (Client / Employé / Chef d'agence) de la personne connectée.
 */
(function () {
  const PUBLIC_PATHS = ['/', '/login', '/register'];

  // Pages réservées aux clients
  const CLIENT_PATHS = ['/accueil', '/nouvelle_demande', '/suivi_demandes', '/profil', '/mes_notifications'];

  // Pages réservées aux employés (y compris chefs d'agence)
  const EMPLOYE_PATHS = [
    '/demandes_recues',
    '/scanner_dossier',
    '/etat_production',
    '/etat_recettes',
    '/statistiques',
    '/contrats',
    '/utilisateurs',
    '/profil_proassur',
    '/notifications',
  ];

  // Parmi les pages employé, celles réservées en plus aux chefs d'agence
  const CHEF_AGENCE_ONLY_PATHS = ['/utilisateurs'];

  const currentPath = window.location.pathname;
  if (PUBLIC_PATHS.includes(currentPath)) {
    return; // Page publique : rien à vérifier
  }

  // Règle injectée tout de suite (avant le rendu du <body>) pour masquer sans
  // flash les éléments réservés aux chefs d'agence (ex: le lien "Utilisateurs"
  // dans la sidebar) tant qu'on ne sait pas encore si la personne l'est.
  const styleMasquage = document.createElement('style');
  styleMasquage.textContent = '.masquer-non-chef-agence .chef-agence-only { display: none !important; }';
  document.head.appendChild(styleMasquage);

  function decodeToken(token) {
    try {
      const payloadBase64 = token.split('.')[1];
      const json = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function redirectToLogin() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.replace('/login');
  }

  // Renvoie chacun vers SON espace (pas vers /login) quand il n'a juste pas le droit
  function redirectVersEspacePersonnel(payload) {
    window.location.replace(payload.role === 'employe' ? '/demandes_recues' : '/accueil');
  }

  const token = localStorage.getItem('token');
  if (!token) {
    redirectToLogin();
    return;
  }

  const payload = decodeToken(token);
  const now = Math.floor(Date.now() / 1000);

  if (!payload || (payload.exp && payload.exp < now)) {
    redirectToLogin();
    return;
  }

  // ── Contrôle par rôle ────────────────────────────────────────────────────
  const estEmploye = payload.role === 'employe';
  const estClient = payload.role === 'client';
  const estChefAgence = estEmploye && payload.estChefAgence === true;

  // Simple employé (pas chef d'agence) : on masque tout ce qui est marqué
  // .chef-agence-only dans la page (ex: le lien "Utilisateurs" de la sidebar)
  if (estEmploye && !estChefAgence) {
    document.documentElement.classList.add('masquer-non-chef-agence');
  }

  if (CLIENT_PATHS.includes(currentPath) && !estClient) {
    redirectVersEspacePersonnel(payload);
    return;
  }

  if (EMPLOYE_PATHS.includes(currentPath) && !estEmploye) {
    redirectVersEspacePersonnel(payload);
    return;
  }

  if (CHEF_AGENCE_ONLY_PATHS.includes(currentPath) && !estChefAgence) {
    redirectVersEspacePersonnel(payload);
    return;
  }

  // Rend l'utilisateur décodé disponible aux autres scripts de la page
  window.utilisateurConnecte = payload;

  // ── Mise à jour du badge "STATUT" et du message de bienvenue ────────────
  document.addEventListener('DOMContentLoaded', function () {
    const statutEl = document.getElementById('badge-statut-utilisateur');
    if (statutEl) {
      let libelle = 'Client';
      if (estEmploye) {
        libelle = estChefAgence ? "Chef d'agence" : 'Employé';
      }
      statutEl.textContent = libelle;
    }

    const bienvenueEl = document.getElementById('message-bienvenue');
    if (bienvenueEl) {
      const civilite = payload.sexe === 'F' ? 'Mme' : 'M.';
      const nom = payload.nom || '';
      bienvenueEl.innerHTML = `Ravi de vous revoir, <strong>${civilite} ${nom}</strong> !`;
    }
  });
})();