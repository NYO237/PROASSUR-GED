function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}


// AFFECTER UNE FONCTION pour afficher les infosdu profil !1 J'AI DEJA FAIT LES AUTRE FICHIERS JS

async function afficher_infos_profil() {
    try {
        const response = await fetch("/api/profil/afficherprofil_employe", {
            method: 'GET',
            headers: getAuthHeaders(),
        });
        
        const data = await response.json();

        if (data.success && data.user) {
            // Remplir les champs du formulaire (ou des spans) avec les données du serveur
            if(document.getElementById('nom_profil')) document.getElementById('nom_profil').value = data.user.nom;
            if(document.getElementById('prenom_profil')) document.getElementById('prenom_profil').value = data.user.prenom;
            if(document.getElementById('tel_profil')) document.getElementById('tel_profil').value = data.user.telephone_whatsapp ;
            if(document.getElementById('identifiant_profil')) document.getElementById('identifiant_profil').value = data.user.identifiant;
            if(document.getElementById('adresse_profil')) document.getElementById('adresse_profil').value = data.user.adresse;
            if(document.getElementById('sexe_profil')) document.getElementById('sexe_profil').value = data.user.sexe;
            
        } else {
            console.log("Erreur lors de la récupération :", data.message);
        }
    } catch (error) {
        console.log("Erreur réseau profil :", error);
    }
}




document.addEventListener("DOMContentLoaded", () => {
    const activerModificationCheckbox = document.getElementById("activer_modification_checkbox");
    
    if (activerModificationCheckbox) {
        activerModificationCheckbox.addEventListener("change", () => {
            // On cible explicitement les inputs et selects du formulaire
            const champs = document.querySelectorAll("#formulaire_profil input, #formulaire_profil select");
            const estCoche = activerModificationCheckbox.checked;

            champs.forEach(champ => {
                // On n'y touche pas, sinon la checkbox se désactive elle-même !
                if (champ.id === "activer_modification_checkbox") return;

                if (estCoche) {
                    // ÉTAT COCHÉ : On débloque tout
                    champ.removeAttribute("readonly");
                    champ.removeAttribute("disabled");
                    champ.classList.remove("bg-light");
                } else {
                    // ÉTAT DÉCOCHÉ : On reverrouille tout
                    if (champ.tagName === "SELECT") {
                        champ.setAttribute("disabled", "true");
                    } else {
                        champ.setAttribute("readonly", "true");
                    }
                    champ.classList.add("bg-light");
                }
            });
        });
    }
});



// Remplace ta fonction de modification par celle-ci :
async function modifier_profil() {
    // 1. Récupération directe des éléments du DOM
    const inputNom = document.getElementById('nom_profil');
    const inputPrenom = document.getElementById('prenom_profil');
    const inputIdentifiant = document.getElementById('identifiant_profil');
    const inputMdp = document.getElementById('mot_de_passe_profil');
    const inputAdresse = document.getElementById('adresse_profil');
    const inputSexe = document.getElementById('sexe_profil');


    const alerte_message_serveur_container = document.getElementById('alerte_message_serveur_container');
    const alerte_message_serveur = document.getElementById("alerte_message_serveur");



    // 2. Construction d'un objet JSON simple
    const donneesProfil = {
        nom_profil: inputNom ? inputNom.value.trim() : '',
        prenom_profil: inputPrenom ? inputPrenom.value.trim() : '',
        identifiant_profil: inputIdentifiant ? inputIdentifiant.value.trim() : '',
        mot_de_passe_profil: inputMdp ? inputMdp.value : '', // pas de trim sur les MDP
        adresse_profil: inputAdresse ? inputAdresse.value.trim() : '',
        sexe_profil: inputSexe ? inputSexe.value : ''
    };

    try {
        // 3. Envoi au serveur en JSON
        const response = await fetch('/api/profil/enregister_modifications_employe', { // Attention à l'URL exacte de ta route
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json' // On prévient le serveur qu'on envoie du JSON
            },
            body: JSON.stringify(donneesProfil),
        });

        const data = await response.json();

        if (data.success) {
            // Optionnel : reverrouiller les champs ou recharger la page
            // window.location.reload();
            alerte_message_serveur_container.classList.remove("alert-danger");
            alerte_message_serveur_container.classList.add("alert-success");
            alerte_message_serveur.textContent = "Modifications appliquées avec succès !";
            alerte_message_serveur_container.style.display = "block";
        } else {
            console.error("Erreur serveur :", data.message);
            alert("Erreur lors de la modification : " + data.message);
            alerte_message_serveur_container.classList.remove("alert-success");
            alerte_message_serveur_container.classList.add("alert-danger");
            alerte_message_serveur.textContent = "Erreur lors de la modification : " + data.message;
            alerte_message_serveur_container.style.display = "block";
        }
    } catch (error) {
        console.error("Erreur réseau lors de la modification :", error);
        alert("Impossible de joindre le serveur.");
        alerte_message_serveur_container.classList.remove("alert-success", "alert-danger");
        alerte_message_serveur_container.classList.add("alert-danger");
        alerte_message_serveur.textContent = "Impossible de joindre le serveur.";
        alerte_message_serveur_container.style.display = "block";
    }
}




















// ─────────────────────────────────────────────────────────────
// STATISTIQUES DE L'EMPLOYÉ (cards + graphique d'évolution)
// ─────────────────────────────────────────────────────────────

let statsEmployeCache = null;
let chartEvolutionDemandes = null;
let chartEvolutionContrats = null;

async function afficher_statistiques_employe() {
    try {
        const response = await fetch("/api/profil/statistiques_employe", {
            method: 'GET',
            headers: getAuthHeaders(),
        });

        const data = await response.json();

        if (data.success && data.statistiques) {
            statsEmployeCache = data.statistiques;

            const boutonActif = document.querySelector('#stats-periode-selector button.active');
            const periodeActive = boutonActif ? boutonActif.dataset.periode : 'aujourdhui';

            appliquer_periode_stats(periodeActive);
            dessiner_graphique_demandes(statsEmployeCache.evolution_demandes);
            dessiner_graphique_contrats(statsEmployeCache.evolution_contrats);
        } else {
            console.log("Erreur lors de la récupération des statistiques :", data.message);
        }
    } catch (error) {
        console.log("Erreur réseau statistiques :", error);
    }
}

// Remplit les cards pour la période choisie, à partir du cache déjà téléchargé
// (pas de nouvel appel réseau à chaque clic sur un onglet de période).
function appliquer_periode_stats(periode) {
    if (!statsEmployeCache) return;

    const documents = statsEmployeCache.documents[periode] || {};
    const demandes = statsEmployeCache.demandes[periode] || {};
    const contratsProduits = statsEmployeCache.contrats[periode] ?? 0;

    const definir = (id, valeur) => {
        const el = document.getElementById(id);
        if (el) el.textContent = valeur ?? 0;
    };

    definir('stat-demandes-total', demandes.total);
    definir('stat-demandes-validees', demandes.validees);
    definir('stat-demandes-rejetees', demandes.rejetees);
    definir('stat-demandes-attente', demandes.en_attente);
    definir('stat-contrats-produits', contratsProduits);
    definir('stat-documents-scannes', documents.total);

    const detailEl = document.getElementById('stat-documents-detail');
    if (detailEl) {
        detailEl.textContent =
            `Cartes roses : ${documents.cartes_roses ?? 0} · ` +
            `Attestations : ${documents.attestations ?? 0} · ` +
            `Contrats scannés : ${documents.contrats_scannes ?? 0}`;
    }
}

// Graphique 1 : évolution des demandes traitées (validées / rejetées).
function dessiner_graphique_demandes(evolution) {
    const canvas = document.getElementById('chart-evolution-demandes');
    if (!canvas || typeof Chart === 'undefined' || !Array.isArray(evolution)) return;

    const labels = evolution.map((jour) => {
        const d = new Date(jour.date);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    });

    if (chartEvolutionDemandes) {
        chartEvolutionDemandes.destroy();
    }

    chartEvolutionDemandes = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Demandes validées',
                    data: evolution.map((j) => j.demandes_validees),
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22, 163, 74, 0.12)',
                    tension: 0.3,
                    fill: true,
                },
                {
                    label: 'Demandes rejetées',
                    data: evolution.map((j) => j.demandes_rejetees),
                    borderColor: '#d72323',
                    backgroundColor: 'rgba(215, 35, 35, 0.08)',
                    tension: 0.3,
                    fill: true,
                },
            ],
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
    });
}

// Graphique 2 : évolution des contrats produits par l'employé (comparaison
// nom_producteur vs Nom + Prénom, calculée côté serveur).
function dessiner_graphique_contrats(evolution) {
    const canvas = document.getElementById('chart-evolution-contrats');
    if (!canvas || typeof Chart === 'undefined' || !Array.isArray(evolution)) return;

    const labels = evolution.map((jour) => {
        const d = new Date(jour.date);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    });

    if (chartEvolutionContrats) {
        chartEvolutionContrats.destroy();
    }

    chartEvolutionContrats = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Contrats produits',
                    data: evolution.map((j) => j.contrats),
                    backgroundColor: '#1746a2',
                    borderRadius: 4,
                    maxBarThickness: 28,
                },
            ],
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const boutonsPeriode = document.querySelectorAll('#stats-periode-selector button');
    boutonsPeriode.forEach((bouton) => {
        bouton.addEventListener('click', () => {
            boutonsPeriode.forEach((b) => b.classList.remove('active'));
            bouton.classList.add('active');
            appliquer_periode_stats(bouton.dataset.periode);
        });
    });
});

// Ne pas oublier d'appeler la fonction au chargement si on est sur la page profil
if (window.location.pathname.includes('/profil_proassur')) {
    console.log("Page profil détectée, lancement de ...");;
    afficher_infos_profil();
    afficher_statistiques_employe();
}