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
    <tr>
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

// ─── Initialisation ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const formulaire = document.getElementById('formulaire-recherche-contrats');
    if (formulaire) formulaire.addEventListener('submit', rechercherContrats);
});