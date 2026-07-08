// const navLinks = document.querySelectorAll(".nav-link");
// const sections = document.querySelectorAll(".tab-content-section");

// navLinks.forEach(link => {
//     link.addEventListener("click", function(e) {
//         // Éviter le comportement par défaut si c'est un lien "#"
//         // if(this.id !== "btn-deconnexion") {
//         //     e.preventDefault();
//         // }
//         e.preventDefault();

//         // Changer l'état actif sur les boutons du menu
//         navLinks.forEach(l => l.classList.remove("active"));
//         this.classList.add("active");
        

//         // Masquer toutes les sections et afficher celle ciblée
//         const targetId = this.getAttribute("data-target");
//         console.log(targetId)
//         sections.forEach(section => section.style.display='none');
        
//         if(targetId) {
//             document.getElementById(targetId).style.display='block';
//         } 
//     });
// });




// On attend que le DOM soit chargé
document.addEventListener("DOMContentLoaded", () => {
    const inputSemaine = document.getElementById("choix-semaine");
    const affichageDates = document.getElementById("affichage-dates-semaine");

    // Initialiser avec la semaine actuelle (optionnel)
    const aujourdhui = new Date();
    const anneeActuelle = aujourdhui.getFullYear();
    // Petite astuce simple pour obtenir le numéro approximatif de la semaine actuelle
    const debutAnnee = new Date(anneeActuelle, 0, 1);
    const jours = Math.floor((aujourdhui - debutAnnee) / (24 * 60 * 60 * 1000));
    const semaineActuelle = Math.ceil((jours + debutAnnee.getDay() + 1) / 7);
    
    // Assigne la valeur par défaut au format YYYY-WWW (ex: 2026-W23)
    inputSemaine.value = `${anneeActuelle}-W${String(semaineActuelle).padStart(2, '0')}`;
    calculerEtAfficherSemaine(inputSemaine.value);

    // Écouter les changements sur le sélecteur de semaine
    inputSemaine.addEventListener("change", (e) => {
        calculerEtAfficherSemaine(e.target.value);
    });

    // Fonction de calcul magique pour transformer "2026-W01" en "Du 29/12/2025 au 04/01/2026"
    function calculerEtAfficherSemaine(valeurSemaine) {
        if (!valeurSemaine) return;

        const parties = valeurSemaine.split("-W");
        const annee = parseInt(parties[0], 10);
        const semaine = parseInt(parties[1], 10);

        // Calcul du premier jour de l'année
        const premierJanvier = new Date(annee, 0, 1);
        const jourDeLaSemaine = premierJanvier.getDay();
        
        // Trouver le premier lundi de l'année ISO
        let premierLundi = new Date(annee, 0, 1);
        if (jourDeLaSemaine <= 4 && jourDeLaSemaine > 0) {
            premierLundi.setDate(premierJanvier.getDate() - jourDeLaSemaine + 1);
        } else if (jourDeLaSemaine === 0) {
            premierLundi.setDate(premierJanvier.getDate() + 1);
        } else {
            premierLundi.setDate(premierJanvier.getDate() + (8 - jourDeLaSemaine));
        }

        // Ajouter le nombre de semaines requises
        const dateDebutSemaine = new Date(premierLundi);
        dateDebutSemaine.setDate(premierLundi.getDate() + (semaine - 1) * 7);

        // Le dimanche est 6 jours après le lundi
        const dateFinSemaine = new Date(dateDebutSemaine);
        dateFinSemaine.setDate(dateDebutSemaine.getDate() + 6);

        // Formater les dates proprement en français (JJ/MM/AAAA)
        const optionsFormat = { day: '2-digit', month: '2-digit', year: 'numeric' };
        const dateDebutStr = dateDebutSemaine.toLocaleDateString("fr-FR", optionsFormat);
        const dateFinStr = dateFinSemaine.toLocaleDateString("fr-FR", optionsFormat);

        // Mettre à jour l'interface utilisateur
        affichageDates.innerHTML = `<i class="fa-solid fa-clock me-2"></i>Du <strong>${dateDebutStr}</strong> au <strong>${dateFinStr}</strong>`;
    }
});

// À inclure à l'intérieur de ton écouteur DOMContentLoaded existant
const inputDateRecette = document.getElementById("choix-date-recette");
const affichageDateRecette = document.getElementById("affichage-date-recette");

if (inputDateRecette && affichageDateRecette) {
    // 1. Initialiser l'input avec la date du jour par défaut (format obligatoire YYYY-MM-DD)
    const aujourdhui = new Date();
    const annee = aujourdhui.getFullYear();
    const mois = String(aujourdhui.getMonth() + 1).padStart(2, '0');
    const jour = String(aujourdhui.getDate()).padStart(2, '0');
    
    inputDateRecette.value = `${annee}-${mois}-${jour}`;
    formaterEtAfficherDate(inputDateRecette.value);

    // 2. Écouter les modifications de l'utilisateur
    inputDateRecette.addEventListener("change", (e) => {
        formaterEtAfficherDate(e.target.value);
    });
}

// Fonction de formatage pour transformer "2026-06-06" en "Samedi 6 juin 2026"
function formaterEtAfficherDate(valeurDate) {
    if (!valeurDate) return;

    const dateObj = new Date(valeurDate);
    
    // Configuration pour un affichage textuel complet en français
    const optionsFormat = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    let dateFormatee = dateObj.toLocaleDateString("fr-FR", optionsFormat);
    
    // Mettre la première lettre en majuscule (ex: "Mardi" au lieu de "mardi")
    dateFormatee = dateFormatee.charAt(0).toUpperCase() + dateFormatee.slice(1);

    // Injection dans le badge
    affichageDateRecette.innerHTML = `<i class="fa-solid fa-clock me-2"></i><strong>${dateFormatee}</strong>`;
}