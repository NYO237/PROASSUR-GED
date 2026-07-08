// public/js/employe/notifications-badge.js
//
// Met à jour tous les éléments marqués de la classe .notif-badge présents sur
// la page (icône cloche du topbar, item de la sidebar, etc.) avec le nombre
// de contrats à surveiller (expirés ou proches de l'échéance sans
// renouvellement). Un seul appel API, partagé par toutes les pages employé.

document.addEventListener('DOMContentLoaded', async () => {
  const badges = document.querySelectorAll('.notif-badge');
  if (badges.length === 0) return;

  try {
    const response = await fetch('/api/notifications', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });

    if (!response.ok) return;

    const data = await response.json();
    const total = data.total || 0;

    badges.forEach((badge) => {
      if (total > 0) {
        badge.textContent = total > 99 ? '99+' : total;
        badge.classList.remove('d-none');
      } else {
        badge.classList.add('d-none');
      }
    });
  } catch (erreur) {
    console.error('[notifications-badge] Erreur de récupération :', erreur);
  }
});