// public/js/employe/employe-dash-demandes-recues.js

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('liste-demandes');
  if (!tbody) return;

  const champRecherche = document.getElementById('recherche-demande');

  const boutons = {
    'En attente': document.getElementById('demandes_en_attente_bouton'),
    'valide': document.getElementById('demandes_valides_bouton'),
    'rejete': document.getElementById('demandes_rejetes_bouton'),
  };

  const endpoints = {
    'En attente': '/api/demandes/demandes_recues_en_attente',
    'valide': '/api/demandes/demandes_recues_valides',
    'rejete': '/api/demandes/demandes_recues_rejetes',
  };

  let statutCourant = 'En attente';
  let demandesChargees = [];

  const modalRejetEl = document.getElementById('modalRejetDemande');
  const modalRejet = modalRejetEl ? new bootstrap.Modal(modalRejetEl) : null;
  const champIdRejet = document.getElementById('rejet-id-demande');
  const champMotifRejet = document.getElementById('rejet-motif-input');
  const btnConfirmerRejet = document.getElementById('confirmer-rejet-bouton');

  function authHeaders(avecJson) {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    if (avecJson) headers['Content-Type'] = 'application/json';
    return headers;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('fr-FR');
  }

  function formatHeure(heureStr) {
    if (!heureStr) return '-';
    return String(heureStr).slice(0, 5);
  }

  // Construit un lien "click to chat" WhatsApp (wa.me), qui ouvre directement
  // la discussion avec ce numéro dans l'app ou sur web.whatsapp.com — pas
  // besoin de la WhatsApp Business API (webhooks, compte développeur Meta...)
  // pour ce simple usage de redirection.
  //
  // Hypothèse : les numéros stockés en base sont au format local camerounais
  // (9 chiffres, ex: 6XXXXXXXX), donc on préfixe l'indicatif +237 si besoin.
  // À ajuster si vos clients ne sont pas tous basés au Cameroun ou si le
  // numéro est déjà stocké avec son indicatif.
  function lienWhatsapp(tel) {
    let numero = String(tel).replace(/[^\d]/g, '');
    if (numero.length === 9) {
      numero = '237' + numero;
    }
    return `https://wa.me/${numero}`;
  }

  function celluleTelephone(tel) {
    if (!tel) return '-';
    return `
      <div class="d-flex align-items-center gap-2">
        <a href="${lienWhatsapp(tel)}" target="_blank" rel="noopener" class="text-success" title="Discuter sur WhatsApp">
          <i class="fa-brands fa-whatsapp fs-5"></i>
        </a>
        <span>${tel}</span>
      </div>
    `;
  }

  function documentsHTML(d) {
    const liens = [];
    if (d.url_cni) liens.push(`<a class="btn btn-outline-secondary btn-sm" href="${d.url_cni}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip me-1"></i>CNI</a>`);
    if (d.url_permis) liens.push(`<a class="btn btn-outline-secondary btn-sm" href="${d.url_permis}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip me-1"></i>Permis</a>`);
    if (d.url_carte_grise) liens.push(`<a class="btn btn-outline-secondary btn-sm" href="${d.url_carte_grise}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip me-1"></i>Carte grise</a>`);
    return `<div class="d-flex flex-wrap gap-1">${liens.join('')}</div>`;
  }

  function celluleMotif(d) {
    if (d.statut_demande === 'rejete') {
      return d.motif_rejet ? d.motif_rejet : 'Motif non précisé';
    }
    return '-';
  }

  function celluleActions(d) {
    if (d.statut_demande !== 'En attente') {
      return d.statut_demande === 'valide'
        ? '<span class="badge bg-success rounded-pill px-3 py-2">Validée</span>'
        : '<span class="badge bg-danger rounded-pill px-3 py-2">Rejetée</span>';
    }
    return `
      <div class="d-flex gap-2 justify-content-center">
        <button class="btn btn-sm btn-outline-success btn-valider" data-id="${d.id_demande}" title="Valider">
          <i class="fa-solid fa-check"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-rejeter" data-id="${d.id_demande}" title="Rejeter">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;
  }

  function ligneHTML(d) {
    const duree = d.duree_mois ? `${d.duree_mois} mois` : '-';
    return `
      <tr>
        <td>${d.id_demande ?? '-'}</td>
        <td>${d.nom || '-'}</td>
        <td>${d.prenom || '-'}</td>
        <td>${celluleTelephone(d.tel_whatsapp)}</td>
        <td>${duree}</td>
        <td>${documentsHTML(d)}</td>
        <td>${formatDate(d.date_demande)}</td>
        <td>${formatHeure(d.heure_demande)}</td>
        <td>${celluleMotif(d)}</td>
        <td class="text-center">${celluleActions(d)}</td>
      </tr>
    `;
  }

  function appliquerRecherche(liste) {
    const terme = (champRecherche?.value || '').trim().toLowerCase();
    if (!terme) return liste;
    return liste.filter((d) =>
      `${d.nom || ''} ${d.prenom || ''}`.toLowerCase().includes(terme)
    );
  }

  function rafraichirTableau() {
    const liste = appliquerRecherche(demandesChargees);

    if (liste.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-secondary py-4">Aucune demande à afficher.</td></tr>`;
      return;
    }

    tbody.innerHTML = liste.map(ligneHTML).join('');

    tbody.querySelectorAll('.btn-valider').forEach((bouton) => {
      bouton.addEventListener('click', () => validerDemande(bouton.dataset.id));
    });
    tbody.querySelectorAll('.btn-rejeter').forEach((bouton) => {
      bouton.addEventListener('click', () => ouvrirModalRejet(bouton.dataset.id));
    });
  }

  async function chargerDemandes(statut) {
    statutCourant = statut;
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-secondary py-4"><span class="spinner-border spinner-border-sm me-2"></span>Chargement...</td></tr>`;

    try {
      const reponse = await fetch(endpoints[statut], { headers: authHeaders() });
      if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
      const data = await reponse.json();
      demandesChargees = Array.isArray(data.demandes) ? data.demandes : [];
      rafraichirTableau();
    } catch (erreur) {
      console.error('[Demandes reçues] Erreur :', erreur);
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-4">Impossible de charger les demandes (${erreur.message}).</td></tr>`;
    }
  }

  function activerBouton(statut) {
    Object.entries(boutons).forEach(([cle, bouton]) => {
      if (!bouton) return;
      bouton.classList.toggle('active', cle === statut);
    });
  }

  Object.entries(boutons).forEach(([statut, bouton]) => {
    if (!bouton) return;
    bouton.addEventListener('click', () => {
      activerBouton(statut);
      chargerDemandes(statut);
    });
  });

  champRecherche?.addEventListener('input', rafraichirTableau);

  async function validerDemande(idDemande) {
    try {
      const reponse = await fetch('/api/demandes/valider_demande', {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({ id: idDemande }),
      });
      const data = await reponse.json();
      if (!reponse.ok || !data.success) throw new Error(data.message || `Erreur serveur (${reponse.status})`);
      chargerDemandes(statutCourant);
    } catch (erreur) {
      console.error('[Demandes reçues] Erreur validation :', erreur);
      alert(`Impossible de valider cette demande : ${erreur.message}`);
    }
  }

  function ouvrirModalRejet(idDemande) {
    if (!modalRejet) return;
    champIdRejet.value = idDemande;
    champMotifRejet.value = '';
    champMotifRejet.classList.remove('is-invalid');
    modalRejet.show();
  }

  btnConfirmerRejet?.addEventListener('click', async () => {
    const idDemande = champIdRejet.value;
    const motif = champMotifRejet.value.trim();

    if (!motif) {
      champMotifRejet.classList.add('is-invalid');
      return;
    }

    try {
      const reponse = await fetch('/api/demandes/rejeter_demande', {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({ id: idDemande, motif }),
      });
      const data = await reponse.json();
      if (!reponse.ok || !data.success) throw new Error(data.message || `Erreur serveur (${reponse.status})`);

      modalRejet.hide();
      chargerDemandes(statutCourant);
    } catch (erreur) {
      console.error('[Demandes reçues] Erreur rejet :', erreur);
      alert(`Impossible de rejeter cette demande : ${erreur.message}`);
    }
  });

  chargerDemandes('En attente'); // Statut actif par défaut (bouton "active" du HTML)
});