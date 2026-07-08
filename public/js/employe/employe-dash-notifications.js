// public/js/employe/employe-dash-notifications.js

document.addEventListener('DOMContentLoaded', async () => {
  const elChargement = document.getElementById('notifications-chargement');
  const elVide = document.getElementById('notifications-vide');
  const elContenu = document.getElementById('notifications-contenu');

  const groupes = {
    expire: { conteneur: document.getElementById('groupe-expire'), titre: 'Contrats expirés', classe: 'palier-expire' },
    'J-7': { conteneur: document.getElementById('groupe-j7'), titre: 'Échéance dans moins de 7 jours', classe: 'palier-j7' },
    'J-14': { conteneur: document.getElementById('groupe-j14'), titre: 'Échéance dans moins de 14 jours', classe: 'palier-j14' },
    'J-30': { conteneur: document.getElementById('groupe-j30'), titre: 'Échéance dans moins de 30 jours', classe: 'palier-j30' },
  };

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('fr-FR');
  }

  function texteJoursRestants(jours) {
    if (jours < 0) return `Expiré depuis ${Math.abs(jours)} jour${Math.abs(jours) > 1 ? 's' : ''}`;
    if (jours === 0) return "Expire aujourd'hui";
    return `Expire dans ${jours} jour${jours > 1 ? 's' : ''}`;
  }

  function carteHTML(n) {
    const nomAssure = [n.assure?.prenom, n.assure?.nom].filter(Boolean).join(' ') || 'Assuré inconnu';
    const vehicule = [n.vehicule?.marque, n.vehicule?.modele].filter(Boolean).join(' ') || 'Véhicule';
    const classePalier = groupes[n.palier]?.classe || 'palier-j30';

    return `
      <div class="notif-card ${classePalier} d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <div class="fw-bold">${vehicule} — ${n.vehicule?.immatriculation || '-'}</div>
          <div class="text-secondary small">
            Assuré : ${nomAssure} · Police : ${n.code_bureau || '-'}/${n.num_police || '-'}
          </div>
          <div class="text-secondary small">
            Échéance : ${formatDate(n.date_echeance)} — ${texteJoursRestants(n.jours_restants)}
          </div>
        </div>
        <span class="badge-palier ${classePalier}">${texteJoursRestants(n.jours_restants)}</span>
      </div>
    `;
  }

  try {
    const response = await fetch('/api/notifications', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });

    if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);

    const data = await response.json();
    const notifications = Array.isArray(data.notifications) ? data.notifications : [];

    elChargement.classList.add('d-none');

    if (notifications.length === 0) {
      elVide.classList.remove('d-none');
      return;
    }

    elContenu.classList.remove('d-none');

    // Regroupement par palier, dans l'ordre d'urgence
    ['expire', 'J-7', 'J-14', 'J-30'].forEach((palier) => {
      const items = notifications.filter((n) => n.palier === palier);
      const groupe = groupes[palier];
      if (items.length === 0 || !groupe) return;

      const titreHTML = `<div class="notif-groupe-titre" style="color:${
        palier === 'expire' || palier === 'J-7' ? '#be123c' : palier === 'J-14' ? '#b45309' : '#1746a2'
      }">${groupe.titre} (${items.length})</div>`;

      groupe.conteneur.innerHTML = titreHTML + items.map(carteHTML).join('');
    });

  } catch (erreur) {
    console.error('[Notifications] Erreur de chargement :', erreur);
    elChargement.classList.add('d-none');
    elVide.classList.remove('d-none');
    elVide.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation fs-1 text-danger mb-3"></i>
      <h5 class="fw-bold">Impossible de charger les notifications</h5>
      <p class="text-secondary mb-0">${erreur.message}</p>
    `;
  }
});