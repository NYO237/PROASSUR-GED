// public/js/client/client-notifications-badge.js
//
// À inclure sur toutes les pages de l'espace client (comme le fait déjà
// notifications-badge.js côté employé) pour afficher, dans la sidebar et/ou
// la cloche du topbar, le nombre d'alertes concernant les contrats du client
// connecté. Sans effet si la page ne contient aucun élément .notif-badge.

document.addEventListener('DOMContentLoaded', async () => {
  const badges = document.querySelectorAll('.notif-badge');
  if (badges.length === 0) return;

  try {
    const response = await fetch('/api/contrats/mes_notifications', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });

    if (!response.ok) return;

    const data = await response.json();
    const total = Number.isInteger(data.total) ? data.total : 0;

    badges.forEach((badge) => {
      badge.textContent = String(total);
      badge.classList.toggle('d-none', total === 0);
    });
  } catch (erreur) {
    console.error('[Badge notifications] Erreur de chargement :', erreur);
  }
});