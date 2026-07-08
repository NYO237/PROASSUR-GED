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

    chargerMesContrats();
});

// ─── Rendu d'une ligne de contrat ─────────────────────────────────────────────

function ligneContratHTML(contrat) {
    return `
        <tr>
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