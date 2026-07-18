function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// Garde en mémoire le type affiché actuellement (client ou employe) pour les actions
let typeUtilisateurActuel = 'client';

// Garde en mémoire la dernière liste brute chargée (avant filtrage) pour la recherche
let dernieresDonneesAffichees = [];

const boutonClients = document.getElementById('type-client');
const boutonEmployes = document.getElementById('type-employe');

if (boutonClients) boutonClients.addEventListener('click', () => { typeUtilisateurActuel = 'client'; afficherClients(); });
if (boutonEmployes) boutonEmployes.addEventListener('click', () => { typeUtilisateurActuel = 'employe'; afficherEmployes(); });

// ─── Affichage des badges de statut ──────────────────────────────────────────

function badgeStatus(status) {
    if (status === 'suspendu') {
        return `<span class="badge bg-warning bg-opacity-25 text-warning-emphasis px-2 py-1 rounded-pill">Suspendu</span>`;
    }
    return `<span class="badge bg-success bg-opacity-10 text-success px-2 py-1 rounded-pill">Actif</span>`;
}

function libelleBoutonSuspendre(status) {
    return status === 'suspendu' ? 'Réactiver' : 'Suspendre';
}

function classeBoutonSuspendre(status) {
    return status === 'suspendu' ? 'btn-success' : 'btn-warning';
}

// Badge de rôle affiché à côté du statut (Client / Employé / Chef d'agence)
function badgeRole(estChefAgence) {
    if (estChefAgence) {
        return `<span class="badge bg-primary bg-opacity-10 text-primary px-2 py-1 rounded-pill">Chef d'agence</span>`;
    }
    return `<span class="badge bg-secondary bg-opacity-10 text-secondary px-2 py-1 rounded-pill">Employé</span>`;
}

// ─── Rendu d'une ligne ────────────────────────────────────────────────────────

function ligneClientHTML(user) {
    return `
    <tr class="ligne-utilisateur-cliquable" onclick='ouvrirDetailsUtilisateur(${user.id_utilisateur}, "client", "${(user.nom + " " + (user.prenom || "")).trim().replace(/'/g, "&#39;")}")'>
        <td>${user.id_utilisateur}</td>
        <td>${user.nom}</td>
        <td>${user.prenom || ''}</td>
        <td>${user.identifiant}</td>
        <td>${user.telephone_whatsapp || 'Non renseignée'}</td>
        <td>${user.adresse || '-'}</td>
        <td>${badgeStatus(user.status)}</td>
        <td><span class="badge bg-info bg-opacity-10 text-info px-2 py-1 rounded-pill">Client</span></td>
        <td>
            <button class='btn btn-sm btn-primary fw-semibold me-1'
                onclick='event.stopPropagation(); ouvrirModaleModifier(${user.id_utilisateur}, "client", ${JSON.stringify(user).replace(/'/g, "&#39;")})'>
                Modifier
            </button>
            <button class='btn btn-sm ${classeBoutonSuspendre(user.status)} fw-semibold me-1'
                onclick='event.stopPropagation(); ouvrirConfirmation("suspendre", ${user.id_utilisateur}, "${user.nom} ${user.prenom || ''}", "${user.status}")'>
                ${libelleBoutonSuspendre(user.status)}
            </button>
            <button class='btn btn-sm btn-danger fw-semibold'
                onclick='event.stopPropagation(); ouvrirConfirmation("supprimer", ${user.id_utilisateur}, "${user.nom} ${user.prenom || ''}")'>
                Supprimer
            </button>
        </td>
    </tr>
    `;
}

function ligneEmployeHTML(user) {
    return `
    <tr class="ligne-utilisateur-cliquable" onclick='ouvrirDetailsUtilisateur(${user.id_utilisateur}, "employe", "${(user.nom + " " + (user.prenom || "")).trim().replace(/'/g, "&#39;")}")'>
        <td>${user.id_utilisateur}</td>
        <td>${user.nom}</td>
        <td>${user.prenom || ''}</td>
        <td>${user.identifiant}</td>
        <td>${user.telephone_whatsapp || 'Non renseigné'}</td>
        <td>${user.adresse || '-'}</td>
        <td>${badgeStatus(user.status)}</td>
        <td>${badgeRole(!!Number(user.est_chef_agence))}</td>
        <td>
            <button class='btn btn-sm btn-primary fw-semibold me-1'
                onclick='event.stopPropagation(); ouvrirModaleModifier(${user.id_utilisateur}, "employe", ${JSON.stringify(user).replace(/'/g, "&#39;")})'>
                Modifier
            </button>
            <button class='btn btn-sm ${classeBoutonSuspendre(user.status)} fw-semibold me-1'
                onclick='event.stopPropagation(); ouvrirConfirmation("suspendre", ${user.id_utilisateur}, "${user.nom} ${user.prenom || ''}", "${user.status}")'>
                ${libelleBoutonSuspendre(user.status)}
            </button>
            <button class='btn btn-sm btn-danger fw-semibold'
                onclick='event.stopPropagation(); ouvrirConfirmation("supprimer", ${user.id_utilisateur}, "${user.nom} ${user.prenom || ''}")'>
                Supprimer
            </button>
        </td>
    </tr>
    `;
}

// ─── Rendu du tableau (réutilisé par affichage initial ET recherche) ─────────

function rendreTableau(users) {
    const tbody = document.getElementById('liste_utilisateurs');
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!users || users.length === 0) {
        const libelle = typeUtilisateurActuel === 'client' ? 'client' : 'employé';
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-3">Aucun ${libelle} trouvé.</td></tr>`;
        return;
    }

    users.forEach(user => {
        tbody.innerHTML += typeUtilisateurActuel === 'client'
            ? ligneClientHTML(user)
            : ligneEmployeHTML(user);
    });
}

// ─── Chargement des listes ────────────────────────────────────────────────────

async function afficherClients() {
    try {
        const response = await fetch('/api/utilisateurs/afficher_infos_clients', {
            method: 'GET',
            headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!data.success) {
            console.log("Erreur Backend : " + data.message);
            return;
        }

        dernieresDonneesAffichees = data.users || [];
        document.getElementById('recherche-utilisateur').value = '';
        rendreTableau(dernieresDonneesAffichees);

    } catch (error) {
        console.log(`Erreur lors de la récupération des clients : ${error}`);
    }
}

async function afficherEmployes() {
    try {
        const response = await fetch('/api/utilisateurs/afficher_infos_employes', {
            method: 'GET',
            headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!data.success) {
            console.log("Erreur Backend : " + data.message);
            return;
        }

        dernieresDonneesAffichees = data.users || [];
        document.getElementById('recherche-utilisateur').value = '';
        rendreTableau(dernieresDonneesAffichees);

    } catch (error) {
        console.log(`Erreur lors de la récupération des employés : ${error}`);
    }
}

// ─── Compteurs Clients / Employés (badges sur les boutons de sélection) ──────
// Réutilise les mêmes endpoints que l'affichage des tableaux, juste pour
// connaître le nombre total de chaque type (indépendamment du filtre affiché).

async function mettreAJourCompteurs() {
    const badgeClients = document.getElementById('badge-total-clients');
    const badgeEmployes = document.getElementById('badge-total-employes');

    try {
        const [reponseClients, reponseEmployes] = await Promise.all([
            fetch('/api/utilisateurs/afficher_infos_clients', { method: 'GET', headers: getAuthHeaders() }),
            fetch('/api/utilisateurs/afficher_infos_employes', { method: 'GET', headers: getAuthHeaders() }),
        ]);
        const [dataClients, dataEmployes] = await Promise.all([
            reponseClients.json(),
            reponseEmployes.json(),
        ]);

        if (badgeClients) badgeClients.textContent = dataClients.success ? dataClients.users.length : '–';
        if (badgeEmployes) badgeEmployes.textContent = dataEmployes.success ? dataEmployes.users.length : '–';

    } catch (error) {
        console.log('Erreur lors du comptage des utilisateurs :', error);
    }
}

// ─── Modale de détails (statistiques d'un utilisateur) ───────────────────────

function statMiniCardHTML(valeur, libelle, couleur) {
    return `
        <div class="col-6 col-md-3">
            <div class="stat-mini-card">
                <div class="stat-valeur"${couleur ? ` style="color:${couleur};"` : ''}>${valeur}</div>
                <div class="stat-libelle">${libelle}</div>
            </div>
        </div>
    `;
}

function rendreStatsClientHTML(stats) {
    return `
        <div class="stat-section-titre"><i class="fa-solid fa-file-circle-question me-1"></i>Demandes de contrat</div>
        <div class="row g-3 mb-4">
            ${statMiniCardHTML(stats.demandes.total, 'Total')}
            ${statMiniCardHTML(stats.demandes.en_attente, 'En attente', '#d97706')}
            ${statMiniCardHTML(stats.demandes.validees, 'Validées', '#16a34a')}
            ${statMiniCardHTML(stats.demandes.rejetees, 'Rejetées', 'var(--rouge-accent)')}
        </div>
        <div class="stat-section-titre"><i class="fa-solid fa-file-contract me-1"></i>Contrats (véhicules à son nom)</div>
        <div class="row g-3">
            ${statMiniCardHTML(stats.contrats.valides, 'Valides', '#16a34a')}
            ${statMiniCardHTML(stats.contrats.en_attente_effet, "En attente d'effet", '#d97706')}
            ${statMiniCardHTML(stats.contrats.expires, 'Expirés', 'var(--slate-500)')}
        </div>
    `;
}

function rendreStatsEmployeHTML(stats) {
    return `
        <div class="stat-section-titre"><i class="fa-solid fa-file-import me-1"></i>Activité de numérisation</div>
        <div class="row g-3 mb-4">
            ${statMiniCardHTML(stats.documents_scannes, 'Documents scannés')}
            ${statMiniCardHTML(stats.contrats_scannes, 'Dont contrats')}
        </div>
        <div class="stat-section-titre"><i class="fa-solid fa-clipboard-check me-1"></i>Traitement des demandes</div>
        <div class="row g-3">
            ${statMiniCardHTML(stats.demandes_validees, 'Demandes validées', '#16a34a')}
            ${statMiniCardHTML(stats.demandes_rejetees, 'Demandes rejetées', 'var(--rouge-accent)')}
        </div>
    `;
}

async function ouvrirDetailsUtilisateur(id, roleType, nomAffiche) {
    document.getElementById('details-nom-utilisateur').textContent = nomAffiche;
    document.getElementById('details-badge-role').textContent = roleType === 'client' ? 'Client' : 'Employé';

    const chargement = document.getElementById('details-chargement');
    const contenu = document.getElementById('details-contenu');
    chargement.classList.remove('d-none');
    contenu.classList.add('d-none');
    contenu.innerHTML = '';

    const modale = new bootstrap.Modal(document.getElementById('modaleDetailsUtilisateur'));
    modale.show();

    try {
        const url = roleType === 'client'
            ? `/api/utilisateurs/stats_client/${id}`
            : `/api/utilisateurs/stats_employe/${id}`;

        const response = await fetch(url, { method: 'GET', headers: getAuthHeaders() });
        const data = await response.json();

        contenu.innerHTML = !data.success
            ? `<p class="text-danger text-center py-4 mb-0">${data.message || "Impossible de charger les statistiques."}</p>`
            : (roleType === 'client' ? rendreStatsClientHTML(data.stats) : rendreStatsEmployeHTML(data.stats));

    } catch (error) {
        console.log('Erreur lors du chargement des statistiques :', error);
        contenu.innerHTML = `<p class="text-danger text-center py-4 mb-0">Impossible de contacter le serveur.</p>`;
    } finally {
        chargement.classList.add('d-none');
        contenu.classList.remove('d-none');
    }
}

// ─── Modale de confirmation (Suspendre / Supprimer) ──────────────────────────

let actionEnAttente = null; // { type: 'suspendre' | 'supprimer', id, nom }

function ouvrirConfirmation(type, id, nom, statusActuel) {
    actionEnAttente = { type, id, nom };

    const titre = document.getElementById('confirmation-titre');
    const message = document.getElementById('confirmation-message');
    const boutonValider = document.getElementById('confirmation-bouton-valider');

    if (type === 'supprimer') {
        titre.textContent = 'Supprimer cet utilisateur ?';
        message.textContent = `Voulez-vous vraiment supprimer définitivement ${nom} ? Cette action est irréversible.`;
        boutonValider.className = 'btn btn-danger fw-semibold';
        boutonValider.textContent = 'Supprimer';
    } else {
        const vaEtreSuspendu = statusActuel !== 'suspendu';
        titre.textContent = vaEtreSuspendu ? 'Suspendre cet utilisateur ?' : 'Réactiver cet utilisateur ?';
        message.textContent = vaEtreSuspendu
            ? `Voulez-vous suspendre ${nom} ? Cette personne ne pourra plus se connecter tant que le compte est suspendu.`
            : `Voulez-vous réactiver le compte de ${nom} ?`;
        boutonValider.className = vaEtreSuspendu ? 'btn btn-warning fw-semibold' : 'btn btn-success fw-semibold';
        boutonValider.textContent = 'Confirmer';
    }

    const modale = new bootstrap.Modal(document.getElementById('modaleConfirmation'));
    modale.show();
}

async function executerActionConfirmee() {
    if (!actionEnAttente) return;

    const { type, id } = actionEnAttente;

    try {
        let response, data;

        if (type === 'supprimer') {
            response = await fetch(`/api/utilisateurs/supprimer/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
        } else {
            response = await fetch(`/api/utilisateurs/basculer_status/${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
            });
        }

        data = await response.json();

        if (!data.success) {
            afficherAlerte(data.message || "Une erreur est survenue.", 'danger');
            return;
        }

        afficherAlerte(data.message, 'success');

        // Recharge la liste correspondante
        if (typeUtilisateurActuel === 'client') afficherClients();
        else afficherEmployes();
        if (type === 'supprimer') mettreAJourCompteurs();

    } catch (error) {
        console.log(`Erreur lors de l'action ${type} :`, error);
        afficherAlerte("Impossible de contacter le serveur.", 'danger');
    } finally {
        actionEnAttente = null;
        const modale = bootstrap.Modal.getInstance(document.getElementById('modaleConfirmation'));
        if (modale) modale.hide();
    }
}

// ─── Modale de modification ──────────────────────────────────────────────────

function ouvrirModaleModifier(id, roleType, user) {
    document.getElementById('modifier-id').value = id;
    document.getElementById('modifier-roleType').value = roleType;

    document.getElementById('modifier-nom').value = user.nom || '';
    document.getElementById('modifier-prenom').value = user.prenom || '';
    document.getElementById('modifier-identifiant').value = user.identifiant || '';
    document.getElementById('modifier-mdp').value = '';

    // Le téléphone est désormais obligatoire pour client ET employé
    const champTelephone = document.getElementById('modifier-telephone');
    if (champTelephone) champTelephone.value = user.telephone_whatsapp || '';

    const champAdresse = document.getElementById('groupe-adresse');
    const champSexe = document.getElementById('groupe-sexe');
    const champChefAgence = document.getElementById('groupe-modifier-chef-agence');
    const caseChefAgence = document.getElementById('modifier-chef-agence');

    if (roleType === 'client') {
        champAdresse.classList.remove('d-none');
        champSexe.classList.remove('d-none');
        document.getElementById('modifier-adresse').value = user.adresse || '';
        document.getElementById('modifier-sexe').value = user.sexe || 'M';
        if (champChefAgence) champChefAgence.classList.add('d-none');
    } else {
        champAdresse.classList.add('d-none');
        champSexe.classList.add('d-none');
        if (champChefAgence) champChefAgence.classList.remove('d-none');
        if (caseChefAgence) caseChefAgence.checked = !!Number(user.est_chef_agence);
    }

    const modale = new bootstrap.Modal(document.getElementById('modaleModifier'));
    modale.show();
}

async function soumettreModification(event) {
    event.preventDefault();

    const id = document.getElementById('modifier-id').value;
    const roleType = document.getElementById('modifier-roleType').value;

    const corps = {
        roleType,
        nom: document.getElementById('modifier-nom').value.trim(),
        prenom: document.getElementById('modifier-prenom').value.trim(),
        identifiant: document.getElementById('modifier-identifiant').value.trim(),
        mot_de_passe: document.getElementById('modifier-mdp').value,
    };

    const champTelephone = document.getElementById('modifier-telephone');
    if (champTelephone) corps.telephone_whatsapp = champTelephone.value.trim();

    if (roleType === 'client') {
        corps.adresse = document.getElementById('modifier-adresse').value.trim();
        corps.sexe = document.getElementById('modifier-sexe').value;
    } else {
        const caseChefAgence = document.getElementById('modifier-chef-agence');
        corps.estChefAgence = caseChefAgence ? caseChefAgence.checked : false;
    }

    const boutonSoumettre = document.getElementById('modifier-bouton-soumettre');
    const texteOriginal = boutonSoumettre.innerHTML;
    boutonSoumettre.disabled = true;
    boutonSoumettre.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Enregistrement...`;

    try {
        const response = await fetch(`/api/utilisateurs/modifier/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(corps),
        });

        const data = await response.json();

        if (!data.success) {
            afficherAlerte(data.message || "Erreur lors de la modification.", 'danger');
            return;
        }

        afficherAlerte(data.message, 'success');

        const modale = bootstrap.Modal.getInstance(document.getElementById('modaleModifier'));
        if (modale) modale.hide();

        if (typeUtilisateurActuel === 'client') afficherClients();
        else afficherEmployes();

    } catch (error) {
        console.log('Erreur lors de la modification :', error);
        afficherAlerte("Impossible de contacter le serveur.", 'danger');
    } finally {
        boutonSoumettre.disabled = false;
        boutonSoumettre.innerHTML = texteOriginal;
    }
}

// ─── Modale de création ───────────────────────────────────────────────────────

function basculerChampsCreation() {
    const roleType = document.getElementById('creer-roleType').value;
    const champAdresse = document.getElementById('groupe-creer-adresse');
    const champSexe = document.getElementById('groupe-creer-sexe');
    const champChefAgence = document.getElementById('groupe-creer-chef-agence');

    // Le téléphone est désormais obligatoire pour tous les rôles : toujours affiché
    if (roleType === 'client') {
        champAdresse.classList.remove('d-none');
        champSexe.classList.remove('d-none');
        if (champChefAgence) champChefAgence.classList.add('d-none');
    } else {
        champAdresse.classList.add('d-none');
        champSexe.classList.add('d-none');
        if (champChefAgence) champChefAgence.classList.remove('d-none');
    }
}

function ouvrirModaleCreer() {
    const formulaire = document.getElementById('formulaire-creer-utilisateur');
    if (formulaire) formulaire.reset();

    // Pré-sélectionne le type d'utilisateur actuellement affiché dans la liste
    document.getElementById('creer-roleType').value = typeUtilisateurActuel;
    basculerChampsCreation();

    const modale = new bootstrap.Modal(document.getElementById('modaleCreer'));
    modale.show();
}

async function soumettreCreation(event) {
    event.preventDefault();

    const roleType = document.getElementById('creer-roleType').value;

    const corps = {
        roleType,
        nom: document.getElementById('creer-nom').value.trim(),
        prenom: document.getElementById('creer-prenom').value.trim(),
        identifiant: document.getElementById('creer-identifiant').value.trim(),
        mot_de_passe: document.getElementById('creer-mdp').value,
        telephone_whatsapp: document.getElementById('creer-telephone').value.trim(),
    };

    if (roleType === 'client') {
        corps.adresse = document.getElementById('creer-adresse').value.trim();
        corps.sexe = document.getElementById('creer-sexe').value;
    } else {
        const caseChefAgence = document.getElementById('creer-chef-agence');
        corps.estChefAgence = caseChefAgence ? caseChefAgence.checked : false;
    }

    const boutonSoumettre = document.getElementById('creer-bouton-soumettre');
    const texteOriginal = boutonSoumettre.innerHTML;
    boutonSoumettre.disabled = true;
    boutonSoumettre.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Création...`;

    try {
        const response = await fetch('/api/utilisateurs/creer', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(corps),
        });

        const data = await response.json();

        if (!data.success) {
            afficherAlerte(data.message || "Erreur lors de la création.", 'danger');
            return;
        }

        afficherAlerte(data.message, 'success');

        const modale = bootstrap.Modal.getInstance(document.getElementById('modaleCreer'));
        if (modale) modale.hide();

        // Bascule sur le type créé pour montrer immédiatement le nouvel utilisateur
        if (roleType === 'client') {
            typeUtilisateurActuel = 'client';
            const radioClient = document.getElementById('type-client');
            if (radioClient) radioClient.checked = true;
            afficherClients();
        } else {
            typeUtilisateurActuel = 'employe';
            const radioEmploye = document.getElementById('type-employe');
            if (radioEmploye) radioEmploye.checked = true;
            afficherEmployes();
        }
        mettreAJourCompteurs();

    } catch (error) {
        console.log('Erreur lors de la création :', error);
        afficherAlerte("Impossible de contacter le serveur.", 'danger');
    } finally {
        boutonSoumettre.disabled = false;
        boutonSoumettre.innerHTML = texteOriginal;
    }
}

// ─── Alertes simples ──────────────────────────────────────────────────────────

function afficherAlerte(message, type) {
    const conteneur = document.getElementById('alerte-utilisateurs-container');
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

// ─── Recherche par nom ────────────────────────────────────────────────────────

function filtrerUtilisateurs(termeRecherche) {
    const terme = termeRecherche.trim().toLowerCase();

    if (terme === '') {
        rendreTableau(dernieresDonneesAffichees);
        return;
    }

    const resultats = dernieresDonneesAffichees.filter(user => {
        const nom = (user.nom || '').toLowerCase();
        const prenom = (user.prenom || '').toLowerCase();
        return nom.includes(terme) || prenom.includes(terme);
    });

    rendreTableau(resultats);
}

// ─── Initialisation ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const boutonConfirmer = document.getElementById('confirmation-bouton-valider');
    if (boutonConfirmer) boutonConfirmer.addEventListener('click', executerActionConfirmee);

    const formModifier = document.getElementById('formulaire-modifier-utilisateur');
    if (formModifier) formModifier.addEventListener('submit', soumettreModification);

    const boutonOuvrirCreer = document.getElementById('bouton-ouvrir-creer');
    if (boutonOuvrirCreer) boutonOuvrirCreer.addEventListener('click', ouvrirModaleCreer);

    const formCreer = document.getElementById('formulaire-creer-utilisateur');
    if (formCreer) formCreer.addEventListener('submit', soumettreCreation);

    const selectRoleCreer = document.getElementById('creer-roleType');
    if (selectRoleCreer) selectRoleCreer.addEventListener('change', basculerChampsCreation);

    const champRecherche = document.getElementById('recherche-utilisateur');
    if (champRecherche) {
        champRecherche.addEventListener('input', (e) => filtrerUtilisateurs(e.target.value));
    }

    // Chargement initial (clients par défaut)
    if (window.location.pathname === '/utilisateurs') {
        afficherClients();
        mettreAJourCompteurs();
    }
});