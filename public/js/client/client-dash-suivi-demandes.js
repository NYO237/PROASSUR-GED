// public/js/client/client-dash-suivi-demandes.js

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('liste-demandes');
  if (!tbody) return;

  const boutons = {
    'En attente': document.getElementById('suivi_demandes_en_attente_button'),
    'valide': document.getElementById('suivi_demandes_valides_button'),
    'rejete': document.getElementById('suivi_demandes_rejetes_button'),
  };

  const endpoints = {
    'En attente': '/api/demandes/suivi_demandes_en_attente',
    'valide': '/api/demandes/suivi_demandes_valides',
    'rejete': '/api/demandes/suivi_demandes_rejetes',
  };

  function authHeaders() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` };
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('fr-FR');
  }

  function formatHeure(heureStr) {
    if (!heureStr) return '-';
    return String(heureStr).slice(0, 5); // "HH:MM:SS" -> "HH:MM"
  }

  function badgeStatut(statut) {
    if (statut === 'valide') return '<span class="badge bg-success px-2.5 py-1.5 rounded-pill">Validée</span>';
    if (statut === 'rejete') return '<span class="badge bg-danger px-2.5 py-1.5 rounded-pill">Rejetée</span>';
    return '<span class="badge bg-warning text-dark px-2.5 py-1.5 rounded-pill">En attente</span>';
  }

  function documentsHTML(d) {
    const liens = [];
    if (d.url_cni) liens.push(`<a class="btn btn-outline-secondary btn-sm" href="${d.url_cni}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip me-1"></i>CNI</a>`);
    if (d.url_permis) liens.push(`<a class="btn btn-outline-secondary btn-sm" href="${d.url_permis}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip me-1"></i>Permis</a>`);
    if (d.url_carte_grise) liens.push(`<a class="btn btn-outline-secondary btn-sm" href="${d.url_carte_grise}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip me-1"></i>Carte grise</a>`);
    return `<div class="d-flex flex-wrap gap-1">${liens.join('')}</div>`;
  }

  // Le libellé d'une garantie "Autre" est tapé librement par le client :
  // on échappe le HTML avant de l'injecter dans le tableau.
  function echapperHTML(texte) {
    const div = document.createElement('div');
    div.textContent = texte ?? '';
    return div.innerHTML;
  }

  function garantiesHTML(d) {
    const garanties = Array.isArray(d.garanties) ? d.garanties : [];
    if (garanties.length === 0) {
      return '<span class="text-muted">Aucune</span>';
    }
    return `<div class="d-flex flex-wrap gap-1">${garanties
      .map((g) => `<span class="badge bg-light text-dark border fw-normal">${echapperHTML(g.libelle ?? g)}</span>`)
      .join('')}</div>`;
  }

  // Petit rond vert/rouge indiquant si la vignette a déjà été payée.
  function vignetteHTML(d) {
    const payee = !!d.vignette_payee;
    const couleur = payee ? '#22c55e' : '#ef4444';
    const titre = payee ? 'Vignette payée' : 'Vignette non payée';
    return `
      <div class="d-flex justify-content-center" title="${titre}">
        <span class="d-inline-block rounded-circle" style="width:14px;height:14px;background-color:${couleur};"></span>
      </div>
    `;
  }

  // La colonne "Observation" affiche le motif de rejet quand la demande a
  // été rejetée, sinon un message générique selon le statut.
  function observationHTML(d) {
    if (d.statut_demande === 'rejete') {
      return `<span class="text-danger">${d.motif_rejet || 'Motif non précisé.'}</span>`;
    }
    if (d.statut_demande === 'valide') {
      return 'Dossier validé par un agent.';
    }
    return 'Dossier en attente de traitement par un agent.';
  }

  function ligneHTML(d) {
    const duree = d.duree_mois ? `${d.duree_mois} mois` : '-';
    return `
      <tr>
        <td>${formatDate(d.date_demande)}</td>
        <td>${formatHeure(d.heure_demande)}</td>
        <td>${documentsHTML(d)}</td>
        <td>${duree}</td>
        <td>${garantiesHTML(d)}</td>
        <td>${vignetteHTML(d)}</td>
        <td>${badgeStatut(d.statut_demande)}</td>
        <td class="small text-muted">${observationHTML(d)}</td>
      </tr>
    `;
  }

  async function chargerDemandes(statut) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-secondary py-4"><span class="spinner-border spinner-border-sm me-2"></span>Chargement...</td></tr>`;

    try {
      const reponse = await fetch(endpoints[statut], { headers: authHeaders() });
      if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
      const data = await reponse.json();
      const demandes = Array.isArray(data.demandes) ? data.demandes : [];

      if (demandes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-secondary py-4">Aucune demande dans cette catégorie.</td></tr>`;
        return;
      }

      tbody.innerHTML = demandes.map(ligneHTML).join('');

    } catch (erreur) {
      console.error('[Suivi demandes] Erreur :', erreur);
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Impossible de charger les demandes (${erreur.message}).</td></tr>`;
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

  async function chargerCompteurs() {
    const cibles = [
      { url: '/api/demandes/nb_demandes', cle: 'nb_demandes', elementId: 'nb_demandes' },
      { url: '/api/demandes/nb_demandes_valides', cle: 'nb_demandes_valides', elementId: 'nb_demandes_valides' },
      { url: '/api/demandes/nb_demandes_rejetes', cle: 'nb_demandes_rejetes', elementId: 'nb_demandes_rejetes' },
    ];

    await Promise.all(cibles.map(async ({ url, cle, elementId }) => {
      try {
        const reponse = await fetch(url, { headers: authHeaders() });
        const data = await reponse.json();
        const el = document.getElementById(elementId);
        if (el && data[cle]) el.textContent = data[cle][cle] ?? 0;
      } catch (erreur) {
        console.error(`[Suivi demandes] Erreur compteur ${cle} :`, erreur);
      }
    }));
  }

  chargerCompteurs();
  chargerDemandes('En attente'); // Statut actif par défaut (bouton "active" du HTML)
});