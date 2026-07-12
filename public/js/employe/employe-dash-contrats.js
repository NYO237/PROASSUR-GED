function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// ─── Formatage ────────────────────────────────────────────────────────────────

function formaterDate(dateISO) {
    if (!dateISO) return 'Non renseignée';
    const d = new Date(dateISO);
    if (isNaN(d.getTime())) return dateISO;
    return d.toLocaleDateString('fr-FR');
}

function formaterMontant(valeur) {
    if (valeur === null || valeur === undefined) return 'Non renseigné';
    const nombre = Number(valeur);
    if (isNaN(nombre)) return valeur;
    return nombre.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' FCFA';
}

function badgeStatutContrat(statutTemporel) {
    const valeur = statutTemporel === null || statutTemporel === undefined
        ? ''
        : String(statutTemporel).trim();

    if (valeur === 'en_cours') {
        return `<span class="badge bg-success bg-opacity-10 text-success px-2 py-1 rounded-pill">En cours</span>`;
    }
    if (valeur === 'en_attente_effet') {
        return `<span class="badge bg-warning bg-opacity-25 text-warning-emphasis px-2 py-1 rounded-pill">En attente d'effet</span>`;
    }
    if (valeur === 'expire') {
        return `<span class="badge bg-danger bg-opacity-10 text-danger px-2 py-1 rounded-pill">Expiré</span>`;
    }
    return `<span class="badge bg-secondary bg-opacity-10 text-secondary px-2 py-1 rounded-pill">Inconnu</span>`;
}

// ─── Rendu d'une ligne ────────────────────────────────────────────────────────

function ligneContratHTML(contrat) {
    const nomAssure = `${contrat.assure_nom || ''} ${contrat.assure_prenom || ''}`.trim() || 'Non renseigné';
    const vehicule = [contrat.marque, contrat.modele].filter(Boolean).join(' ')
        + (contrat.immatriculation ? ` (${contrat.immatriculation})` : '');

    return `
    <tr class="contrat-row" data-id-document="${contrat.id_document}" role="button" tabindex="0" title="Voir les détails du contrat">
        <td>${contrat.bureau || 'Non renseigné'}</td>
        <td>${contrat.num_police || 'Non renseigné'}</td>
        <td>${nomAssure}</td>
        <td>${vehicule || 'Non renseigné'}</td>
        <td>${formaterDate(contrat.date_emission)}</td>
        <td>${formaterDate(contrat.date_effet)}</td>
        <td>${formaterDate(contrat.date_echeance)}</td>
        <td>${formaterMontant(contrat.prime_nette)}</td>
        <td>${badgeStatutContrat(contrat.statut_temporel)}</td>
    </tr>
    `;
}

// ─── Rendu du tableau ─────────────────────────────────────────────────────────

function rendreTableauContrats(contrats, messageVide) {
    const tbody = document.getElementById('liste_contrats');
    if (!tbody) return;

    if (!contrats || contrats.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-3">${messageVide}</td></tr>`;
        return;
    }

    tbody.innerHTML = contrats.map(ligneContratHTML).join('');
}

// ─── Alertes simples ──────────────────────────────────────────────────────────

function afficherAlerteContrats(message, type) {
    const conteneur = document.getElementById('alerte-contrats-container');
    if (!conteneur) {
        alert(message);
        return;
    }
    conteneur.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

function viderAlerteContrats() {
    const conteneur = document.getElementById('alerte-contrats-container');
    if (conteneur) conteneur.innerHTML = '';
}

// ─── Recherche ────────────────────────────────────────────────────────────────

async function rechercherContrats(event) {
    event.preventDefault();

    const champNom = document.getElementById('recherche-contrat-nom');
    const nom = champNom.value.trim();

    if (!nom) {
        afficherAlerteContrats("Veuillez saisir un nom à rechercher.", 'warning');
        return;
    }

    const boutonRechercher = document.getElementById('bouton-rechercher-contrats');
    const texteOriginal = boutonRechercher.innerHTML;
    boutonRechercher.disabled = true;
    boutonRechercher.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Recherche...`;

    try {
        const response = await fetch(`/api/contrats-employe/rechercher?nom=${encodeURIComponent(nom)}`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });

        const data = await response.json();

        if (!data.success) {
            afficherAlerteContrats(data.message || "Erreur lors de la recherche.", 'danger');
            rendreTableauContrats([], "Aucun contrat trouvé.");
            return;
        }

        viderAlerteContrats();
        rendreTableauContrats(data.contrats, `Aucun contrat trouvé pour « ${nom} ».`);

    } catch (error) {
        console.log('Erreur lors de la recherche des contrats :', error);
        afficherAlerteContrats("Impossible de contacter le serveur.", 'danger');
    } finally {
        boutonRechercher.disabled = false;
        boutonRechercher.innerHTML = texteOriginal;
    }
}

// ─── Détails d'un contrat (modal) ──────────────────────────────────────────────

function ligneInfoHTML(libelle, valeur) {
    const contenu = (valeur === null || valeur === undefined || valeur === '')
        ? 'Non renseigné'
        : valeur;

    return `
        <div class="col-6 col-md-4">
            <p class="text-uppercase text-secondary mb-1" style="font-size:0.72rem; letter-spacing:0.5px;">${libelle}</p>
            <p class="fw-semibold mb-0">${contenu}</p>
        </div>
    `;
}

function garantiesListeHTML(garanties) {
    if (!garanties || garanties.length === 0) {
        return `<p class="text-muted mb-0">Aucune garantie renseignée pour ce contrat.</p>`;
    }

    const items = garanties.map(g => `
        <li class="mb-1"><i class="fa-solid fa-check text-success me-2"></i>${g.libelle || 'Non renseigné'}</li>
    `).join('');

    return `<ul class="list-unstyled mb-0">${items}</ul>`;
}

function construireContenuModalDetails(contrat) {
    const nomAssure = `${contrat.assure_nom || ''} ${contrat.assure_prenom || ''}`.trim() || 'Non renseigné';
    const nomConducteur = `${contrat.nom_conducteur || ''} ${contrat.prenom_conducteur || ''}`.trim() || 'Non renseigné';
    const vehicule = [contrat.vehicule_categorie, contrat.marque, contrat.modele].filter(Boolean).join(' ') || 'Non renseigné';

    return `
        <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-3 border-bottom">
            <div>
                <h5 class="fw-bold mb-1">Police n° ${contrat.num_police || 'Non renseigné'}</h5>
                <p class="text-secondary small mb-0">Bureau ${contrat.bureau || 'Non renseigné'}${contrat.adresse_bureau ? ' · ' + contrat.adresse_bureau : ''}</p>
            </div>
            <div>${badgeStatutContrat(contrat.statut_temporel)}</div>
        </div>

        <h6 class="fw-bold text-primary mb-3"><i class="fa-solid fa-user me-2"></i>Assuré</h6>
        <div class="row g-3 mb-4">
            ${ligneInfoHTML("Nom et prénom", nomAssure)}
            ${ligneInfoHTML("Téléphone", contrat.assure_telephone)}
            ${ligneInfoHTML("Profession", contrat.assure_profession)}
            ${ligneInfoHTML("Activité", contrat.assure_activite)}
            ${ligneInfoHTML("Adresse", contrat.assure_adresse)}
        </div>

        <h6 class="fw-bold text-primary mb-3"><i class="fa-solid fa-car me-2"></i>Véhicule</h6>
        <div class="row g-3 mb-4">
            ${ligneInfoHTML("Véhicule", vehicule)}
            ${ligneInfoHTML("Immatriculation", contrat.immatriculation)}
            ${ligneInfoHTML("N° Châssis", contrat.numero_chassis)}
            ${ligneInfoHTML("Conducteur", nomConducteur)}
        </div>

        <h6 class="fw-bold text-primary mb-3"><i class="fa-solid fa-calendar-days me-2"></i>Dates clés</h6>
        <div class="row g-3 mb-4">
            ${ligneInfoHTML("Date d'émission", formaterDate(contrat.date_emission))}
            ${ligneInfoHTML("Date d'effet", formaterDate(contrat.date_effet))}
            ${ligneInfoHTML("Date d'échéance", formaterDate(contrat.date_echeance))}
        </div>

        <h6 class="fw-bold text-primary mb-3"><i class="fa-solid fa-shield-halved me-2"></i>Garanties</h6>
        <div class="mb-4">
            ${garantiesListeHTML(contrat.garanties)}
        </div>

        <h6 class="fw-bold text-primary mb-3"><i class="fa-solid fa-coins me-2"></i>Prime</h6>
        <div class="row g-3">
            ${ligneInfoHTML("Prime nette", formaterMontant(contrat.prime_nette))}
            ${ligneInfoHTML("DTA", formaterMontant(contrat.dta))}
            ${ligneInfoHTML("Prime totale", formaterMontant(contrat.prime_totale))}
        </div>
    `;
}

async function ouvrirModalDetailsContrat(idDocument) {
    const modalElement = document.getElementById('modalDetailsContrat');
    if (!modalElement || typeof bootstrap === 'undefined') return;

    const zoneChargement = document.getElementById('modal-details-loading');
    const zoneContenu = document.getElementById('modal-details-contenu');
    const zoneErreur = document.getElementById('modal-details-erreur');

    // Réinitialise l'état de la modal avant chaque ouverture
    zoneChargement.classList.remove('d-none');
    zoneContenu.classList.add('d-none');
    zoneContenu.innerHTML = '';
    zoneErreur.classList.add('d-none');
    zoneErreur.textContent = '';

    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    modal.show();

    try {
        const response = await fetch(`/api/contrats-employe/details/${idDocument}`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "Impossible de récupérer les détails du contrat.");
        }

        zoneContenu.innerHTML = construireContenuModalDetails(data.contrat);
        zoneContenu.classList.remove('d-none');

    } catch (error) {
        console.log('Erreur lors du chargement des détails du contrat :', error);
        zoneErreur.textContent = error.message || "Impossible de contacter le serveur.";
        zoneErreur.classList.remove('d-none');
    } finally {
        zoneChargement.classList.add('d-none');
    }
}

// ─── Initialisation ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const formulaire = document.getElementById('formulaire-recherche-contrats');
    if (formulaire) formulaire.addEventListener('submit', rechercherContrats);

    const corpsTableau = document.getElementById('liste_contrats');
    if (corpsTableau) {
        corpsTableau.addEventListener('click', (event) => {
            const ligne = event.target.closest('tr[data-id-document]');
            if (!ligne) return;
            ouvrirModalDetailsContrat(ligne.dataset.idDocument);
        });

        corpsTableau.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const ligne = event.target.closest('tr[data-id-document]');
            if (!ligne) return;
            event.preventDefault();
            ouvrirModalDetailsContrat(ligne.dataset.idDocument);
        });
    }
});