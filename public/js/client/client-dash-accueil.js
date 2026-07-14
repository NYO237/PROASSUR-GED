// public/js/client/client-dash-accueil.js

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── État courant pour la recherche ──────────────────────────────────────────
let statutContratActuel = 'en_cours'; // 'en_cours' | 'en_attente' | 'expire'
let tousLesContrats = { en_cours: [], en_attente: [], expires: [] };

// ─── Gestion visuelle des boutons d'onglet ───────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const boutonsStatut = document.querySelectorAll('.btn-status');
    boutonsStatut.forEach(bouton => {
        bouton.addEventListener('click', () => {
            boutonsStatut.forEach(b => b.classList.remove('active'));
            bouton.classList.add('active');
        });
    });

    const champRecherche = document.getElementById('recherche-contrat');
    if (champRecherche) {
        champRecherche.addEventListener('input', (e) => filtrerContrats(e.target.value));
    }

    document.getElementById('contrats_en_cours_bouton')?.addEventListener('click', () => afficherOnglet('en_cours'));
    document.getElementById('contrats_en_attente_bouton')?.addEventListener('click', () => afficherOnglet('en_attente'));
    document.getElementById('contrats_expires_bouton')?.addEventListener('click', () => afficherOnglet('expires'));

    // Ouverture de la modale de détails au clic (ou Entrée/Espace) sur une ligne
    const corpsTableau = document.getElementById('liste-contrats');
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

    chargerMesContrats();
});

// ─── Rendu d'une ligne de contrat ─────────────────────────────────────────────

function ligneContratHTML(contrat) {
    return `
        <tr class="contrat-row" data-id-document="${contrat.id_document}" role="button" tabindex="0" title="Voir les détails du contrat">
            <td class="fw-bold">${contrat.numero_bureau}</td>
            <td>${contrat.numero_police}</td>
            <td>${contrat.numero_carte_rose}</td>
            <td>${contrat.vehicule}</td>
            <td>${contrat.date_emission}</td>
            <td>${contrat.date_effet}</td>
            <td>${contrat.date_echeance}</td>
            <td>${Number(contrat.accessoires).toLocaleString('fr-FR')}</td>
            <td class="fw-semibold">${Number(contrat.prime_totale).toLocaleString('fr-FR')} FCFA</td>
        </tr>
    `;
}

function rendreTableauContrats(contrats) {
    const tbody = document.getElementById('liste-contrats');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!contrats || contrats.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-3">Aucun contrat trouvé.</td></tr>`;
        return;
    }

    contrats.forEach((contrat) => {
        tbody.innerHTML += ligneContratHTML(contrat);
    });
}

// ─── Changement d'onglet ──────────────────────────────────────────────────────

function afficherOnglet(statut) {
    statutContratActuel = statut;
    reinitialiserRecherche();
    rendreTableauContrats(tousLesContrats[statut]);
}

// ─── Recherche par numéro de police ──────────────────────────────────────────

function filtrerContrats(termeRecherche) {
    const terme = termeRecherche.trim().toLowerCase();
    const listeActuelle = tousLesContrats[statutContratActuel];

    if (terme === '') {
        rendreTableauContrats(listeActuelle);
        return;
    }

    const resultats = listeActuelle.filter((contrat) => {
        const police = (contrat.numero_police || '').toLowerCase();
        const bureau = (contrat.numero_bureau || '').toLowerCase();
        return police.includes(terme) || bureau.includes(terme) || `${bureau}/${police}`.includes(terme);
    });

    rendreTableauContrats(resultats);
}

function reinitialiserRecherche() {
    const champRecherche = document.getElementById('recherche-contrat');
    if (champRecherche) champRecherche.value = '';
}

// ─── Chargement des contrats depuis l'API ────────────────────────────────────

async function chargerMesContrats() {
    try {
        const response = await fetch('/api/contrats/mes_contrats', {
            method: 'GET',
            headers: getAuthHeaders(),
        });

        const data = await response.json();

        if (!data.success) {
            console.error('Erreur Backend :', data.message);
            return;
        }

        tousLesContrats = {
            en_cours: data.contrats_en_cours || [],
            en_attente: data.contrats_en_attente || [],
            expires: data.contrats_expires || [],
        };

        mettreAJourCartesStatistiques();
        rendreTableauContrats(tousLesContrats[statutContratActuel]);

    } catch (error) {
        console.error('Erreur lors de la récupération des contrats :', error);
    }
}

// ─── Mise à jour des cards de statistiques (total / valides / expirés) ──────
// "Valide" = date d'échéance non encore passée (regroupe en_cours + en_attente d'effet)
// "Expiré" = date d'échéance déjà passée

function mettreAJourCartesStatistiques() {
    const nbEnCours = tousLesContrats.en_cours.length;
    const nbEnAttente = tousLesContrats.en_attente.length;
    const nbExpires = tousLesContrats.expires.length;

    const nbTotal = nbEnCours + nbEnAttente + nbExpires;
    const nbValides = nbEnCours + nbEnAttente;

    const elTotal = document.getElementById('nb_demandes');
    const elValides = document.getElementById('nb_demandes_valides');
    const elExpires = document.getElementById('nb_demandes_rejetes');

    if (elTotal) elTotal.textContent = nbTotal;
    if (elValides) elValides.textContent = nbValides;
    if (elExpires) elExpires.textContent = nbExpires;
}

// ─── Détails d'un contrat (modal) ──────────────────────────────────────────────
// Même logique que côté employé (employe-dash-contrats.js), mais affichée
// directement dans accueil.html plutôt que dans une page dédiée.

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

function badgeStatutContrat(statutCalcule) {
    const valeur = statutCalcule === null || statutCalcule === undefined
        ? ''
        : String(statutCalcule).trim();

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
    const vehicule = [contrat.vehicule_categorie, contrat.marque, contrat.modele].filter(Boolean).join(' ') || 'Non renseigné';
    const nomConducteur = `${contrat.nom_conducteur || ''} ${contrat.prenom_conducteur || ''}`.trim() || 'Non renseigné';

    return `
        <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-3 border-bottom">
            <div>
                <h5 class="fw-bold mb-1">Police n° ${contrat.num_police || 'Non renseigné'}</h5>
                <p class="text-secondary small mb-0">Bureau ${contrat.code_bureau || 'Non renseigné'}${contrat.adresse_bureau ? ' · ' + contrat.adresse_bureau : ''}</p>
            </div>
            <div>${badgeStatutContrat(contrat.statut_calcule)}</div>
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
            ${ligneInfoHTML("N° Carte rose", contrat.num_carte_rose)}
        </div>

        <h6 class="fw-bold text-primary mb-3"><i class="fa-solid fa-shield-halved me-2"></i>Garanties</h6>
        <div class="mb-4">
            ${garantiesListeHTML(contrat.garanties)}
        </div>

        <h6 class="fw-bold text-primary mb-3"><i class="fa-solid fa-coins me-2"></i>Prime</h6>
        <div class="row g-3">
            ${ligneInfoHTML("Prime nette", formaterMontant(contrat.prime_nette))}
            ${ligneInfoHTML("Accessoires", formaterMontant(contrat.accessoires))}
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
        const response = await fetch(`/api/contrats/details/${idDocument}`, {
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