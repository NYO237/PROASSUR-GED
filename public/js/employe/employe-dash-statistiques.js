// public/js/employe/employe-dash-statistiques.js

let graphiqueContrats = null;
let graphiqueCA = null;
let graphiqueDemandes = null;
let periodeActuelle = 'jour';

const boutonsPeriode = document.querySelectorAll('#selecteur-periode [data-periode]');

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

function appliquerLibelles(periode) {
  const l = LIBELLES_PERIODE[periode] || LIBELLES_PERIODE.mois;
  document.getElementById('lbl-contrats').textContent = l.contrats;
  document.getElementById('lbl-ca').textContent = l.ca;
  document.getElementById('lbl-demandes').textContent = l.demandes;
  document.getElementById('lbl-vehicules').textContent = l.vehicules;
  document.getElementById('lbl-assures').textContent = l.assures;
}

async function chargerSynthese(periode) {
  try {
    const response = await fetch(`/api/statistiques/synthese?periode=${periode}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) return;

    document.getElementById('stat-contrats').textContent = data.contrats;
    document.getElementById('stat-ca').textContent = formaterFCFA(data.ca);
    document.getElementById('stat-demandes').textContent = data.demandes;
    document.getElementById('stat-vehicules').textContent = data.vehicules_assures;
    document.getElementById('stat-assures').textContent = data.assures;

    const evoContrats = formaterEvolution(data.evolution_contrats);
    const evoCA = formaterEvolution(data.evolution_ca);
    const evoDemandes = formaterEvolution(data.evolution_demandes);

    const elEvoContrats = document.getElementById('stat-evolution-contrats');
    elEvoContrats.textContent = evoContrats.texte;
    elEvoContrats.className = `small fw-semibold ${evoContrats.classe}`;

    const elEvoCA = document.getElementById('stat-evolution-ca');
    elEvoCA.textContent = evoCA.texte;
    elEvoCA.className = `small fw-semibold ${evoCA.classe}`;

    const elEvoDemandes = document.getElementById('stat-evolution-demandes');
    elEvoDemandes.textContent = evoDemandes.texte;
    elEvoDemandes.className = `small fw-semibold ${evoDemandes.classe}`;
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
    dessinerGraphiqueDemandes(data.labels, data.demandes);
  } catch (error) {
    console.error('Erreur chargement évolution :', error);
  }
}

function dessinerGraphiqueContrats(labels, valeurs) {
  const ctx = document.getElementById('chart-contrats').getContext('2d');
  if (graphiqueContrats) graphiqueContrats.destroy();

  graphiqueContrats = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Contrats émis',
        data: valeurs,
        borderColor: '#9606d4',
        backgroundColor: 'rgba(203, 70, 229, 0.12)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#cb46e5',
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function dessinerGraphiqueDemandes(labels, valeurs) {
  const ctx = document.getElementById('chart-demandes').getContext('2d');
  if (graphiqueDemandes) graphiqueDemandes.destroy();

  graphiqueDemandes = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Demandes reçues',
        data: valeurs,
        borderColor: '#0ea5e9',
        backgroundColor: 'rgba(14, 165, 233, 0.12)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#0ea5e9',
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function dessinerGraphiqueCA(labels, valeurs) {
  const ctx = document.getElementById('chart-ca').getContext('2d');
  if (graphiqueCA) graphiqueCA.destroy();

  graphiqueCA = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: "Chiffre d'affaires (FCFA)",
        data: valeurs,
        backgroundColor: '#cb46e5',
        borderRadius: 6,
        maxBarThickness: 36,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formaterFCFA(ctx.parsed.y),
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (val) => Number(val).toLocaleString('fr-FR') },
        },
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
}

boutonsPeriode.forEach((btn) => {
  btn.addEventListener('click', () => basculerPeriode(btn.dataset.periode));
});

// Chargement initial
basculerPeriode(periodeActuelle);