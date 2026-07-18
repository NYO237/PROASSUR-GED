// public/js/employe/employe-dash-notifications.js

document.addEventListener('DOMContentLoaded', async () => {
  const elChargement = document.getElementById('notifications-chargement');
  const elVide = document.getElementById('notifications-vide');
  const elContenu = document.getElementById('notifications-contenu');

  // Ordre d'affichage : demandes en attente d'abord (temps réel, en journée
  // seulement), puis contrats, du plus urgent au moins urgent.
  const groupes = {
    'demande-urgente': { conteneur: document.getElementById('groupe-demande-urgente'), titre: 'Demandes en attente depuis plus de 4h', classe: 'palier-demande-urgente' },
    'demande-attente': { conteneur: document.getElementById('groupe-demande-attente'), titre: 'Demandes en attente depuis plus de 2h', classe: 'palier-demande-attente' },
    expire: { conteneur: document.getElementById('groupe-expire'), titre: 'Contrats expirés', classe: 'palier-expire' },
    'J-7': { conteneur: document.getElementById('groupe-j7'), titre: 'Échéance dans moins de 7 jours', classe: 'palier-j7' },
    'J-14': { conteneur: document.getElementById('groupe-j14'), titre: 'Échéance dans moins de 14 jours', classe: 'palier-j14' },
    'J-30': { conteneur: document.getElementById('groupe-j30'), titre: 'Échéance dans moins de 30 jours', classe: 'palier-j30' },
  };

  const couleurTitre = {
    'demande-urgente': '#a21caf',
    'demande-attente': '#7c3aed',
    expire: '#be123c',
    'J-7': '#be123c',
    'J-14': '#b45309',
    'J-30': '#1746a2',
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

  function texteDureeAttente(minutes) {
    if (minutes == null || isNaN(minutes)) return 'En attente';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `En attente depuis ${m} min`;
    if (m === 0) return `En attente depuis ${h}h`;
    return `En attente depuis ${h}h${String(m).padStart(2, '0')}`;
  }

  function carteContratHTML(n) {
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

  function carteDemandeHTML(n) {
    const nomClient = [n.client?.prenom, n.client?.nom].filter(Boolean).join(' ') || 'Client inconnu';
    const classePalier = groupes[n.palier]?.classe || 'palier-demande-attente';
    const heure = n.heure_demande ? String(n.heure_demande).slice(0, 5) : '';

    return `
      <div class="notif-card ${classePalier} d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <div class="fw-bold"><i class="fa-solid fa-file-circle-question me-1"></i> Nouvelle demande de contrat non traitée</div>
          <div class="text-secondary small">
            Client : ${nomClient} · Tél : ${n.client?.telephone || '-'}
          </div>
          <div class="text-secondary small">
            Reçue le ${formatDate(n.date_demande)}${heure ? ' à ' + heure : ''}
          </div>
        </div>
        <span class="badge-palier ${classePalier}">${texteDureeAttente(n.minutes_ecoulees)}</span>
      </div>
    `;
  }

  function carteHTML(n) {
    return n.type === 'demande' ? carteDemandeHTML(n) : carteContratHTML(n);
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

    // Regroupement par palier, dans l'ordre d'urgence défini dans `groupes`
    Object.keys(groupes).forEach((palier) => {
      const items = notifications.filter((n) => n.palier === palier);
      const groupe = groupes[palier];
      if (items.length === 0 || !groupe || !groupe.conteneur) return;

      const titreHTML = `<div class="notif-groupe-titre" style="color:${couleurTitre[palier] || '#1746a2'}">${groupe.titre} (${items.length})</div>`;

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