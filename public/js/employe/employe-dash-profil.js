
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




















// Ne pas oublier d'appeler la fonction au chargement si on est sur la page profil
if (window.location.pathname.includes('/profil_proassur')) {
    console.log("Page profil détectée, lancement de ...");;
    afficher_infos_profil();
}


