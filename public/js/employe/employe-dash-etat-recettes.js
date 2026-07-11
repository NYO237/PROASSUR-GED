// public/js/employe/employe-dash-etat-recettes.js

const choixDate     = document.getElementById('choix-date-recette');
const affichageDate = document.getElementById('affichage-date-recette');
const btnCharger    = document.getElementById('btn-charger-recettes');
const btnExporter   = document.getElementById('btn-generer-production');
const zoneResultats = document.getElementById('zone-donnees-recettes');

const numFr = v => Number(v || 0).toLocaleString('fr-FR');

// ── Mise à jour du badge date ─────────────────────────────────────────────────
choixDate.addEventListener('change', () => {
  if (!choixDate.value) return;
  affichageDate.textContent = new Date(choixDate.value + 'T12:00:00')
    .toLocaleDateString('fr-FR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
});

// ── Zone de scan (affichée si aucun rapport en BDD pour cette date) ───────────
function afficherZoneScan() {
  zoneResultats.innerHTML = `
    <div class="card border-0 shadow-sm rounded-4 p-4 bg-white">
      <h5 class="fw-bold mb-4 text-dark">
        <i class="fa-solid fa-file-pdf text-danger me-2"></i>
        Scanner les documents du jour
      </h5>

      <div class="container-fluid bg-warning bg-opacity-10 text-warning-emphasis p-3 rounded-3
                  d-flex align-items-start shadow-sm mb-4 border border-warning border-opacity-25">
        <i class="fa-solid fa-triangle-exclamation me-2 mt-1"></i>
        <p class="mb-0 small">
          <strong>Important :</strong> Utilisez uniquement des PDFs exportés nativement depuis ORASS
          (Fichier → Exporter → PDF), <strong>pas</strong> via l'imprimante "Microsoft Print to PDF".
        </p>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-12 col-md-6">
          <label class="form-label small fw-semibold text-secondary">
            Etat des Encaissements <span class="text-danger">*</span>
          </label>
          <input type="file" id="fichier-encaissements" accept=".pdf" class="form-control">
          <div class="form-text">PDF obligatoire — sections ESP., PE, VB, ER</div>
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label small fw-semibold text-secondary">
            Bordereau de Règlement des Commissions
            <span class="badge bg-secondary fw-normal ms-1">Optionnel</span>
          </label>
          <input type="file" id="fichier-commissions" accept=".pdf" class="form-control">
          <div class="form-text">PDF optionnel — total commissions à régler</div>
        </div>
      </div>

      <div class="text-end">
        <button class="btn btn-primary fw-bold px-4 rounded-3" id="btn-scanner">
          <i class="fa-solid fa-magnifying-glass me-2"></i>Scanner et enregistrer
        </button>
      </div>

      <div id="zone-progression" class="mt-3 d-none">
        <div class="alert alert-info d-flex align-items-center mb-0">
          <span class="spinner-border spinner-border-sm me-3 flex-shrink-0"></span>
          <span id="msg-progression">Extraction des données en cours...</span>
        </div>
      </div>
    </div>`;

  document.getElementById('btn-scanner').addEventListener('click', scannerDocuments);
}

// ── Affichage du tableau rapport ──────────────────────────────────────────────
function afficherRapport(r) {
  const esp         = Number(r.sur_emission_especes      || 0);
  const elec        = Number(r.sur_emission_electronique || 0);
  const surEmission = esp + elec;
  const sp          = Number(r.solde_initial_especes     || 0);
  const sc          = Number(r.solde_initial_cheques     || 0);
  const com         = Number(r.commissions_payees        || 0);
  const ade         = Number(r.autres_depenses           || 0);
  const vb          = Number(r.versement_banque          || 0);
  const vc          = Number(r.versement_compta          || 0);
  const sf_esp      = Number(r.solde_final_especes       || 0);
  const sf_chq      = Number(r.solde_final_cheques       || 0);

  const dateFormatee = new Date(r.date_rapport + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  // Helper : cellule td numérique formatée
  const td = (v, cls = '') =>
    `<td class="text-end ${cls}">${numFr(v)}</td>`;

  zoneResultats.innerHTML = `
    <div class="card border-0 shadow-sm rounded-4 p-4 bg-white">

      <!-- En-tête -->
      <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h5 class="fw-bold text-dark mb-0">Rapport journalier</h5>
          <p class="text-secondary mb-0 small">${dateFormatee}
            ${r.numero_bordereau
              ? `&nbsp;·&nbsp; Bordereau n° <strong>${r.numero_bordereau}</strong>`
              : ''}</p>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary rounded-3" onclick="afficherZoneScan()">
            <i class="fa-solid fa-arrow-rotate-left me-1"></i>Re-scanner
          </button>
          <span class="badge bg-success fs-6 px-3 py-2 rounded-3">
            <i class="fa-solid fa-check me-1"></i>Enregistré
          </span>
        </div>
      </div>

      <!-- SECTION ACTIVITES -->
      <h6 class="fw-semibold text-secondary mb-2 mt-2">
        <i class="fa-solid fa-chart-bar me-1"></i>Activités de la journée
      </h6>
      <div class="table-card-wrapper border">
        <div class="table-responsive mb-4">
          <table class="table table-bordered table-sm align-middle small">
            <thead class="table-light">
              <tr>
                <th style="width:55%"></th>
                <th class="text-center">PRODUCTIONS</th>
                <th class="text-center">ENCAISSEMENTS</th>
                <th class="text-center">ÉCART</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>EMISSIONS HORS POOL TPV</td>
                ${td(surEmission)} ${td(surEmission)} ${td(0)}
              </tr>
              <tr><td>EMISSIONS POOL TPV</td>${td(0)}${td(0)}${td(0)}</tr>
              <tr><td>COURTAGE</td>${td(0)}${td(0)}${td(0)}</tr>
              <tr><td>DEPOT CLIENTS</td>${td(0)}${td(0)}${td(0)}</tr>
              <tr><td>RECOUVREMENT</td>${td(0)}${td(0)}${td(0)}</tr>
              <tr class="table-secondary fw-bold">
                <td>TOTAL</td>${td(surEmission,'fw-bold')}${td(surEmission,'fw-bold')}${td(0,'fw-bold')}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- SECTION ENCAISSEMENTS -->
      <h6 class="fw-semibold text-secondary mb-2">
        <i class="fa-solid fa-coins me-1"></i>Détail des encaissements
      </h6>
      <div class="table-card-wrapper border">
      <div class="table-responsive mb-4">
        <table class="table table-bordered table-sm align-middle small">
          <thead class="table-light">
            <tr>
              <th style="width:35%"></th>
              <th class="text-center">ESPÈCES</th>
              <th class="text-center">CHÈQUES/ÉLEC</th>
              <th class="text-center">COMP/REGUL</th>
              <th class="text-center">ENC DÉPLACÉ</th>
              <th class="text-center">VIREMENT</th>
              <th class="text-center fw-bold">TOTAUX</th>
            </tr>
          </thead>
          <tbody>
            <!-- SUR EMISSIONS -->
            <tr>
              <td>SUR EMISSIONS</td>
              ${td(esp)} ${td(elec)} ${td(0)} ${td(0)} ${td(0)}
              ${td(surEmission, 'fw-bold')}
            </tr>
            <tr><td>POOL TPV</td>${td(0)}${td(0)}${td(0)}${td(0)}${td(0)}${td(0,'fw-bold')}</tr>
            <tr><td>HORS ORASS</td>${td(0)}${td(0)}${td(0)}${td(0)}${td(0)}${td(0,'fw-bold')}</tr>
            <tr><td>COURTAGE</td>${td(0)}${td(0)}${td(0)}${td(0)}${td(0)}${td(0,'fw-bold')}</tr>
            <tr><td>DEPOTS CLIENTS</td>${td(0)}${td(0)}${td(0)}${td(0)}${td(0)}${td(0,'fw-bold')}</tr>

            <!-- TOTAUX -->
            <tr class="table-secondary fw-bold">
              <td>TOTAUX</td>
              ${td(esp,'fw-bold')} ${td(elec,'fw-bold')} ${td(0,'fw-bold')}
              ${td(0,'fw-bold')} ${td(0,'fw-bold')} ${td(surEmission,'fw-bold')}
            </tr>

            <tr><td>REMBST CLIENTS/AVENANT</td>${td(0)}${td(0)}${td(0)}${td(0)}${td(0)}${td(0,'fw-bold')}</tr>

            <!-- ENCAISSEMENTS NETS -->
            <tr class="table-secondary fw-bold">
              <td>ENCAISSEMENTS NETS (5) - (6)</td>
              ${td(esp,'fw-bold')} ${td(elec,'fw-bold')} ${td(0,'fw-bold')}
              ${td(0,'fw-bold')} ${td(0,'fw-bold')} ${td(surEmission,'fw-bold')}
            </tr>

            <!-- SOLDE INITIAL -->
            <tr>
              <td>SOLDE INITIAL (à l'ouverture)</td>
              ${td(sp)} ${td(sc)} ${td(0)} ${td(0)} ${td(0)}
              ${td(sp + sc, 'fw-bold')}
            </tr>

            <!-- COMMISSIONS PAYEES (auto depuis bordereau) -->
            <tr>
              <td>
                COMMISSIONS PAYÉES
                <span class="badge bg-success-subtle text-success border border-success-subtle ms-1 fw-normal">
                  <i class="fa-solid fa-file-check me-1"></i>bordereau
                </span>
              </td>
              ${td(com)} ${td(0)} ${td(0)} ${td(0)} ${td(0)} ${td(com,'fw-bold')}
            </tr>

            <!-- AUTRES DEPENSES (saisie manuelle) -->
            <tr>
              <td>
                AUTRES DÉPENSES
                <button class="btn btn-sm btn-outline-secondary ms-1 py-0 px-1 rounded-2"
                        onclick="ouvrirEdition('autres_depenses', 'Autres dépenses', ${ade})">
                  <i class="fa-solid fa-pen fa-xs"></i>
                </button>
              </td>
              ${td(ade)} ${td(0)} ${td(0)} ${td(0)} ${td(0)} ${td(ade,'fw-bold')}
            </tr>

            <!-- VERSEMENTS BANQUE (saisie manuelle) -->
            <tr>
              <td>
                VERSEMENTS À LA BANQUE
                <button class="btn btn-sm btn-outline-secondary ms-1 py-0 px-1 rounded-2"
                        onclick="ouvrirEdition('versement_banque', 'Versements à la banque', ${vb})">
                  <i class="fa-solid fa-pen fa-xs"></i>
                </button>
              </td>
              ${td(vb)} ${td(0)} ${td(0)} ${td(0)} ${td(0)} ${td(vb,'fw-bold')}
            </tr>

            <!-- VERSEMENTS COMPTA (saisie manuelle) -->
            <tr>
              <td>
                VERSEMENTS À LA COMPTABILITÉ
                <button class="btn btn-sm btn-outline-secondary ms-1 py-0 px-1 rounded-2"
                        onclick="ouvrirEdition('versement_compta', 'Versements à la comptabilité', ${vc})">
                  <i class="fa-solid fa-pen fa-xs"></i>
                </button>
              </td>
              ${td(vc)} ${td(0)} ${td(0)} ${td(0)} ${td(0)} ${td(vc,'fw-bold')}
            </tr>

            <!-- SOLDE FINAL -->
            <tr class="fw-bold" style="background:#fff3cd;">
              <td>SOLDE FINAL [(7)+(8)] - [(9)+(10)+(11)+(12)]</td>
              ${td(sf_esp,'fw-bold')} ${td(sf_chq,'fw-bold')}
              ${td(0,'fw-bold')} ${td(0,'fw-bold')} ${td(0,'fw-bold')}
              ${td(sf_esp + sf_chq,'fw-bold')}
            </tr>
          </tbody>
        </table>
      </div>
      </div>

      <!-- OBSERVATIONS -->
      <h6 class="fw-semibold text-secondary mb-2">
        <i class="fa-solid fa-note-sticky me-1"></i>Remarques
      </h6>
      <div class="mb-3">
        <textarea class="form-control" id="champ-observations" rows="2"
                  placeholder="Observations du responsable...">${r.observations || ''}</textarea>
        <div class="text-end mt-1">
          <button class="btn btn-sm btn-outline-primary rounded-3" onclick="sauvegarderObservations()">
            <i class="fa-solid fa-floppy-disk me-1"></i>Sauvegarder remarques
          </button>
        </div>
      </div>

      <!-- MODAL ÉDITION MANUELLE -->
      <div id="modal-edition" class="d-none border rounded-3 p-3 bg-light mb-3">
        <h6 class="fw-bold mb-3" id="modal-titre"></h6>
        <div class="row g-2 align-items-end">
          <div class="col-auto">
            <label class="form-label small mb-1">Montant (FCFA)</label>
            <input type="number" id="modal-valeur" class="form-control"
                   min="0" style="width:200px" placeholder="0">
          </div>
          <div class="col-auto">
            <button class="btn btn-secondary me-1" onclick="fermerEdition()">Annuler</button>
            <button class="btn btn-success" onclick="validerEdition()">
              <i class="fa-solid fa-check me-1"></i>Valider
            </button>
          </div>
        </div>
      </div>

    </div>`;
}

// ── Scanner les PDFs ──────────────────────────────────────────────────────────
async function scannerDocuments() {
  const fichierEnc  = document.getElementById('fichier-encaissements')?.files[0];
  const fichierComm = document.getElementById('fichier-commissions')?.files[0];

  if (!fichierEnc) {
    alert("Le fichier 'Etat des encaissements' est obligatoire.");
    return;
  }
  if (!choixDate.value) {
    alert("Veuillez sélectionner la date du rapport avant de scanner.");
    return;
  }

  const btnScan   = document.getElementById('btn-scanner');
  const zoneProgr = document.getElementById('zone-progression');
  const msgProgr  = document.getElementById('msg-progression');

  btnScan.disabled = true;
  zoneProgr.classList.remove('d-none');
  msgProgr.textContent = 'Extraction des données du PDF...';

  try {
    const fd = new FormData();
    fd.append('encaissements', fichierEnc);
    if (fichierComm) {
      fd.append('commissions', fichierComm);
      msgProgr.textContent = 'Extraction des deux documents...';
    }

    const resp = await fetch('/api/rapport-journalier/scan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: fd,
    });
    const data = await resp.json();

    if (!data.success) {
      alert(data.message || 'Erreur lors du scan.');
      return;
    }

    // Recharge depuis la BDD pour afficher le rapport complet
    await chargerRapport();

  } catch (e) {
    console.error(e);
    alert('Erreur réseau lors du scan : ' + e.message);
  } finally {
    if (btnScan) btnScan.disabled = false;
    zoneProgr?.classList.add('d-none');
  }
}

// ── Charger un rapport depuis la BDD ─────────────────────────────────────────
async function chargerRapport() {
  if (!choixDate.value) { alert('Veuillez sélectionner une date.'); return; }

  const orig = btnCharger.innerHTML;
  btnCharger.disabled = true;
  btnCharger.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Chargement...';

  try {
    const resp = await fetch(`/api/rapport-journalier?date=${choixDate.value}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await resp.json();

    if (!data.success) { alert(data.message); return; }

    if (!data.rapport) {
      // Pas encore de rapport pour ce jour → zone de scan
      afficherZoneScan();
    } else {
      afficherRapport(data.rapport);
    }
  } catch (e) {
    console.error(e);
    alert('Impossible de contacter le serveur.');
  } finally {
    btnCharger.disabled = false;
    btnCharger.innerHTML = orig;
  }
}

// ── Édition manuelle ──────────────────────────────────────────────────────────
let champEnEdition = null;

function ouvrirEdition(champ, titre, valeurActuelle) {
  champEnEdition = champ;
  document.getElementById('modal-titre').textContent = `Modifier : ${titre}`;
  document.getElementById('modal-valeur').value = valeurActuelle || 0;
  document.getElementById('modal-edition').classList.remove('d-none');
  document.getElementById('modal-valeur').focus();
}

function fermerEdition() {
  document.getElementById('modal-edition').classList.add('d-none');
  champEnEdition = null;
}

async function validerEdition() {
  if (!champEnEdition) return;
  const valeur = Number(document.getElementById('modal-valeur').value) || 0;
  await sauvegarderChamp({ [champEnEdition]: valeur });
  fermerEdition();
}

async function sauvegarderObservations() {
  const obs = document.getElementById('champ-observations')?.value || '';
  await sauvegarderChamp({ observations: obs });
}

async function sauvegarderChamp(payload) {
  try {
    const resp = await fetch(`/api/rapport-journalier/${choixDate.value}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (data.success) {
      await chargerRapport(); // Rafraîchit le tableau avec le nouveau solde final
    } else {
      alert(data.message || 'Erreur lors de la sauvegarde.');
    }
  } catch (e) {
    alert('Erreur réseau lors de la sauvegarde.');
  }
}

// ── Export Excel ──────────────────────────────────────────────────────────────
async function exporterExcel() {
  if (!choixDate.value) { alert('Veuillez sélectionner une date.'); return; }

  const orig = btnExporter.innerHTML;
  btnExporter.disabled = true;
  btnExporter.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Génération...';

  try {
    const resp = await fetch(`/api/rapport-journalier/export?date=${choixDate.value}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      alert(err.message || 'Erreur lors de la génération Excel.');
      return;
    }

    const blob = await resp.blob();
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `rapport_journalier_${choixDate.value}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

  } catch (e) {
    alert('Impossible de générer le fichier Excel.');
  } finally {
    btnExporter.disabled = false;
    btnExporter.innerHTML = orig;
  }
}

// ── Écouteurs principaux ──────────────────────────────────────────────────────
btnCharger.addEventListener('click', chargerRapport);
btnExporter.addEventListener('click', exporterExcel);