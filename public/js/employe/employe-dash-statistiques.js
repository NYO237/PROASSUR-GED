// public/js/employe/employe-dash-statistiques.js

let graphiqueContrats = null;
let graphiqueCA = null;
let graphiqueDemandes = null;
let graphiqueCategoriesVehicules = null;
let periodeActuelle = 'jour';

const boutonsPeriode = document.querySelectorAll('#selecteur-periode [data-periode]');

// --- Habillage graphique global (police, couleurs, infobulles) partagé par tous les graphiques ---
if (window.Chart) {
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.plugins.tooltip.backgroundColor = '#0f2c59';
  Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
  Chart.defaults.plugins.tooltip.bodyColor = '#e2e8f0';
  Chart.defaults.plugins.tooltip.titleFont = { family: "'Inter', sans-serif", weight: '600', size: 13 };
  Chart.defaults.plugins.tooltip.bodyFont = { family: "'Inter', sans-serif", size: 12 };
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.cornerRadius = 10;
  Chart.defaults.plugins.tooltip.boxPadding = 6;
  Chart.defaults.plugins.tooltip.displayColors = true;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.font = { family: "'Inter', sans-serif", size: 12, weight: '500' };

  // Plugin maison : affiche un total au centre des graphiques en anneau (doughnut)
  Chart.register({
    id: 'texteCentral',
    afterDraw(chart) {
      const options = chart.config.options.plugins && chart.config.options.plugins.texteCentral;
      if (!options) return;
      const { ctx, chartArea } = chart;
      const centreX = (chartArea.left + chartArea.right) / 2;
      const centreY = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f2c59';
      ctx.font = "700 26px 'Inter', sans-serif";
      ctx.fillText(options.valeur, centreX, centreY - 11);
      ctx.fillStyle = '#94a3b8';
      ctx.font = "600 11px 'Inter', sans-serif";
      ctx.fillText(options.label, centreX, centreY + 14);
      ctx.restore();
    },
  });
}

const LIBELLES_PERIODE = {
  jour: {
    contrats: "Contrats aujourd'hui",
    ca: "CA aujourd'hui",
    demandes: "Demandes aujourd'hui",
    vehicules: "Véhicules assurés aujourd'hui",
    assures: "Assurés aujourd'hui",
  },
  semaine: {
    contrats: 'Contrats cette semaine',
    ca: 'CA cette semaine',
    demandes: 'Demandes cette semaine',
    vehicules: 'Véhicules assurés cette semaine',
    assures: 'Assurés cette semaine',
  },
  mois: {
    contrats: 'Contrats ce mois',
    ca: 'CA ce mois',
    demandes: 'Demandes ce mois',
    vehicules: 'Véhicules assurés ce mois',
    assures: 'Assurés ce mois',
  },
  tout: {
    contrats: 'Contrats au total',
    ca: 'CA total',
    demandes: 'Demandes au total',
    vehicules: 'Véhicules assurés (total)',
    assures: 'Assurés (total)',
  },
};

const LIBELLE_PERIODE_TEXTE = {
  jour: "aujourd'hui",
  semaine: 'cette semaine',
  mois: 'ce mois',
  tout: 'sur toute la période',
};

function formaterFCFA(valeur) {
  return Number(valeur).toLocaleString('fr-FR') + ' FCFA';
}

function formaterEvolution(pourcentage) {
  if (pourcentage === null || pourcentage === undefined) {
    return { texte: '—', classe: 'text-secondary' };
  }
  const arrondi = pourcentage.toFixed(1);
  if (pourcentage > 0) return { texte: `+${arrondi}%`, classe: 'text-success' };
  if (pourcentage < 0) return { texte: `${arrondi}%`, classe: 'text-danger' };
  return { texte: '0%', classe: 'text-secondary' };
}

function appliquerEvolution(id, valeur) {
  const el = document.getElementById(id);
  if (!el) return;
  const { texte, classe } = formaterEvolution(valeur);
  el.textContent = texte;
  el.className = `small fw-semibold ${classe}`;
}

function appliquerLibelles(periode) {
  const l = LIBELLES_PERIODE[periode] || LIBELLES_PERIODE.mois;
  document.getElementById('lbl-contrats').textContent = l.contrats;
  document.getElementById('lbl-ca').textContent = l.ca;
  document.getElementById('lbl-demandes').textContent = l.demandes;
  document.getElementById('lbl-vehicules').textContent = l.vehicules;
  document.getElementById('lbl-assures').textContent = l.assures;

  const labelTop = document.getElementById('top-employes-periode-label');
  if (labelTop) labelTop.textContent = `(${LIBELLE_PERIODE_TEXTE[periode] || ''})`;
}

// Répartit des segments (contrats ou demandes) sur une barre selon leurs valeurs (largeurs en %)
function appliquerSegments(segments) {
  const total = segments.reduce((somme, s) => somme + (Number(s.valeur) || 0), 0);
  segments.forEach((s) => {
    const el = document.getElementById(s.id);
    if (!el) return;
    const pourcentage = total > 0 ? (Number(s.valeur) / total) * 100 : 0;
    el.style.width = `${pourcentage}%`;
  });
}

async function chargerSynthese(periode) {
  try {
    const response = await fetch(`/api/statistiques/synthese?periode=${periode}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) return;

    // --- Chiffre d'affaires / véhicules / assurés ---
    document.getElementById('stat-ca').textContent = formaterFCFA(data.ca);
    appliquerEvolution('stat-evolution-ca', data.evolution_ca);
    document.getElementById('stat-vehicules').textContent = data.vehicules_assures;
    document.getElementById('stat-assures').textContent = data.assures;

    // --- Contrats : total + détail en cours / attente d'effet / expirés ---
    const c = data.contrats || {};
    document.getElementById('stat-contrats').textContent = c.total ?? 0;
    appliquerEvolution('stat-evolution-contrats', c.evolution);
    document.getElementById('contrats-en-cours').textContent = c.en_cours ?? 0;
    document.getElementById('contrats-attente-effet').textContent = c.en_attente_effet ?? 0;
    document.getElementById('contrats-expires').textContent = c.expires ?? 0;
    appliquerSegments([
      { id: 'seg-contrats-en-cours', valeur: c.en_cours },
      { id: 'seg-contrats-attente-effet', valeur: c.en_attente_effet },
      { id: 'seg-contrats-expires', valeur: c.expires },
    ]);

    // --- Demandes : total + détail en attente / validées / rejetées ---
    const d = data.demandes || {};
    document.getElementById('stat-demandes').textContent = d.total ?? 0;
    appliquerEvolution('stat-evolution-demandes', d.evolution);
    document.getElementById('demandes-en-attente').textContent = d.en_attente ?? 0;
    document.getElementById('demandes-validees').textContent = d.validees ?? 0;
    document.getElementById('demandes-rejetees').textContent = d.rejetees ?? 0;
    appliquerSegments([
      { id: 'seg-demandes-attente', valeur: d.en_attente },
      { id: 'seg-demandes-validees', valeur: d.validees },
      { id: 'seg-demandes-rejetees', valeur: d.rejetees },
    ]);

    const badgeTaux = document.getElementById('demandes-taux-acceptation');
    if (badgeTaux) {
      if (d.taux_acceptation === null || d.taux_acceptation === undefined) {
        badgeTaux.textContent = 'Taux —';
      } else {
        badgeTaux.textContent = `${d.taux_acceptation.toFixed(0)}% acceptées`;
      }
    }

    // --- Répartition des véhicules assurés par catégorie (bonus) ---
    dessinerGraphiqueCategoriesVehicules(data.repartition_vehicules_categorie || []);
  } catch (error) {
    console.error('Erreur chargement synthèse :', error);
  }
}

async function chargerEvolution(periode) {
  try {
    const response = await fetch(`/api/statistiques/evolution?periode=${periode}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) return;

    dessinerGraphiqueContrats(data.labels, data.contrats);
    dessinerGraphiqueCA(data.labels, data.chiffre_affaires);
    dessinerGraphiqueDemandes(data.labels, data.demandes_par_statut);
  } catch (error) {
    console.error('Erreur chargement évolution :', error);
  }
}

async function chargerTopEmployes(periode) {
  const conteneur = document.getElementById('top-employes-liste');
  if (!conteneur) return;

  try {
    const response = await fetch(`/api/statistiques/top-employes?periode=${periode}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) return;

    const employes = data.employes || [];
    if (employes.length === 0) {
      conteneur.innerHTML = '<p class="text-secondary small mb-0">Aucune activité enregistrée pour cette période.</p>';
      return;
    }

    conteneur.innerHTML = employes.map((e) => {
      const initiales = `${(e.prenom || '').charAt(0)}${(e.nom || '').charAt(0)}`.toUpperCase() || '?';
      const nomComplet = [e.prenom, e.nom].filter(Boolean).join(' ') || 'Employé';
      const classeRang = e.rang <= 3 ? `rank-${e.rang}` : '';

      return `
        <div class="leaderboard-item">
          <div class="rank-badge ${classeRang}">${e.rang}</div>
          <div class="employe-avatar">${initiales}</div>
          <div class="flex-grow-1">
            <div class="fw-semibold" style="color: var(--bleu-primary);">${nomComplet}</div>
            <div class="d-flex flex-wrap gap-2 mt-1">
              <span class="employe-stat-badge scans"><i class="fa-solid fa-file-signature me-1"></i>${e.contrats_scannes} contrat(s) scanné(s)</span>
              <span class="employe-stat-badge demandes"><i class="fa-solid fa-inbox me-1"></i>${e.demandes_traitees} demande(s) traitée(s)</span>
            </div>
          </div>
          <div class="text-end">
            <div class="fw-bold fs-5" style="color: var(--bleu-primary);">${e.score}</div>
            <div class="small text-secondary">points</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Erreur chargement top employés :', error);
    conteneur.innerHTML = '<p class="text-danger small mb-0">Impossible de charger le classement.</p>';
  }
}

function dessinerGraphiqueContrats(labels, valeurs) {
  const canvas = document.getElementById('chart-contrats');
  const ctx = canvas.getContext('2d');
  if (graphiqueContrats) graphiqueContrats.destroy();

  const degrade = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 260);
  degrade.addColorStop(0, 'rgba(150, 6, 212, 0.25)');
  degrade.addColorStop(1, 'rgba(150, 6, 212, 0)');

  graphiqueContrats = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Contrats émis',
        data: valeurs,
        borderColor: '#9606d4',
        backgroundColor: degrade,
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#ffffff',
        pointHoverBackgroundColor: '#9606d4',
        pointBorderColor: '#9606d4',
        pointHoverBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          border: { display: false },
          ticks: { precision: 0, font: { size: 11 }, padding: 8 },
        },
      },
    },
  });
}

function dessinerGraphiqueDemandes(labels, parStatut) {
  const ctx = document.getElementById('chart-demandes').getContext('2d');
  if (graphiqueDemandes) graphiqueDemandes.destroy();

  const donnees = parStatut || { en_attente: [], validees: [], rejetees: [] };

  graphiqueDemandes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Validées',
          data: donnees.validees,
          backgroundColor: '#16a34a',
          hoverBackgroundColor: '#15803d',
          borderRadius: 5,
          borderSkipped: false,
          stack: 'demandes',
        },
        {
          label: 'En attente',
          data: donnees.en_attente,
          backgroundColor: '#f59e0b',
          hoverBackgroundColor: '#d97706',
          borderRadius: 5,
          borderSkipped: false,
          stack: 'demandes',
        },
        {
          label: 'Rejetées',
          data: donnees.rejetees,
          backgroundColor: '#d72323',
          hoverBackgroundColor: '#b91c1c',
          borderRadius: 5,
          borderSkipped: false,
          stack: 'demandes',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      barPercentage: 0.6,
      categoryPercentage: 0.7,
      plugins: {
        legend: { display: true, position: 'bottom' },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 11 } },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          border: { display: false },
          ticks: { precision: 0, font: { size: 11 }, padding: 8 },
        },
      },
    },
  });
}

function dessinerGraphiqueCA(labels, valeurs) {
  const canvas = document.getElementById('chart-ca');
  const ctx = canvas.getContext('2d');
  if (graphiqueCA) graphiqueCA.destroy();

  const degrade = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 260);
  degrade.addColorStop(0, '#cb46e5');
  degrade.addColorStop(1, '#9606d4');

  graphiqueCA = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: "Chiffre d'affaires (FCFA)",
        data: valeurs,
        backgroundColor: degrade,
        hoverBackgroundColor: '#9606d4',
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 36,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formaterFCFA(ctx.parsed.y),
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          border: { display: false },
          ticks: {
            font: { size: 11 },
            padding: 8,
            callback: (val) => Number(val).toLocaleString('fr-FR'),
          },
        },
      },
    },
  });
}

function dessinerGraphiqueCategoriesVehicules(repartition) {
  const canvas = document.getElementById('chart-categories-vehicules');
  const messageVide = document.getElementById('chart-categories-vehicules-vide');
  const conteneur = canvas ? canvas.closest('.chart-wrap') : null;
  if (!canvas) return;

  if (!repartition.length) {
    if (graphiqueCategoriesVehicules) { graphiqueCategoriesVehicules.destroy(); graphiqueCategoriesVehicules = null; }
    canvas.classList.add('d-none');
    if (messageVide) messageVide.classList.remove('d-none');
    if (conteneur) conteneur.classList.add('chart-wrap-vide');
    return;
  }

  canvas.classList.remove('d-none');
  if (messageVide) messageVide.classList.add('d-none');
  if (conteneur) conteneur.classList.remove('chart-wrap-vide');

  const ctx = canvas.getContext('2d');
  if (graphiqueCategoriesVehicules) graphiqueCategoriesVehicules.destroy();

  const palette = ['#1746a2', '#16a34a', '#f59e0b', '#cb46e5', '#d72323', '#64748b'];
  const total = repartition.reduce((somme, r) => somme + (Number(r.nb) || 0), 0);

  graphiqueCategoriesVehicules = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: repartition.map((r) => r.categorie),
      datasets: [{
        data: repartition.map((r) => r.nb),
        backgroundColor: palette,
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverBorderWidth: 3,
        hoverOffset: 8,
        spacing: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: true, position: 'bottom', labels: { padding: 14 } },
        texteCentral: { valeur: total, label: total > 1 ? 'VÉHICULES' : 'VÉHICULE' },
      },
    },
  });
}

function basculerPeriode(periode) {
  periodeActuelle = periode;

  boutonsPeriode.forEach((btn) => {
    btn.classList.toggle('btn-gradient-actif', btn.dataset.periode === periode);
  });

  appliquerLibelles(periode);
  chargerSynthese(periode);
  chargerEvolution(periode);
  chargerTopEmployes(periode);
}

boutonsPeriode.forEach((btn) => {
  btn.addEventListener('click', () => basculerPeriode(btn.dataset.periode));
});

// Chargement initial
basculerPeriode(periodeActuelle);