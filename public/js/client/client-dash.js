
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const btnSoumettre = document.getElementById('btn-soumettre');
if (btnSoumettre) {
  btnSoumettre.addEventListener('click', async () => {
    const inputCni = document.getElementById('input-cni');
    const inputPermis = document.getElementById('input-permis');
    const inputCarteGrise = document.getElementById('input-carte-grise');

    if (!inputCni?.files[0]) {
      alert('Veuillez sélectionner la photo de votre CNI.');
      return;
    }
    if (!inputCarteGrise?.files[0]) {
      alert('Veuillez sélectionner la photo de votre Carte grise.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      window.location.replace('/login');
      return;
    }

    const formData = new FormData();
    formData.append('cni', inputCni.files[0]);
    formData.append('input-carte-grise', inputCarteGrise.files[0]);

    if (inputPermis?.files[0]) {
      formData.append('input-permis', inputPermis.files[0]);
    }

    try {
      btnSoumettre.disabled = true;
      btnSoumettre.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Envoi en cours...';

      const response = await fetch('/api/demandes/nouvelledemande', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        window.location.replace('/login');
        return;
      }

      if (data.success) {
        alert('Vos documents ont été enregistrés avec succès.');
        window.location.href = '/suivi_demandes';
      } else {
        alert(`Erreur lors de l'envoi : ${data.message}`);
      }
    } catch (error) {
      console.error('Erreur réseau :', error);
      alert('Impossible de joindre le serveur.');
    } finally {
      btnSoumettre.disabled = false;
      btnSoumettre.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i> Soumettre mon dossier d\'assurance';
    }
  });
}



    // const suivi_demandes_en_attente_button = document.getElementById('suivi_demandes_en_attente_button');
    // suivi_demandes_en_attente_button.addEventListener("click",afficherDemandes_en_attente);




async function afficherDemandes_en_attente(){
    if (window.location.pathname === '/suivi_demandes' || window.location.href.includes('/suivi_demandes')) {
        try {
            const response = await fetch('/api/demandes/suivi_demandes_en_attente', {
                method : 'GET',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                const tbody = document.getElementById('liste-demandes');
                if (!tbody) return;

                tbody.innerHTML = '';

                if (!data.demandes || data.demandes.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Aucune demande trouvée.</td></tr>`;
                    return;
                }

                data.demandes.forEach((demande) => {
                    // Formater la date SQL en format lisible (JJ/MM/AAAA)
                    const dateLisible = new Date(demande.date_demande).toLocaleDateString('fr-FR');
                    
                    tbody.innerHTML += `
                        <tr>
                            <td>${dateLisible}</td>
                            <td>${demande.heure_demande || '-'}</td>
                             <td>
                                <a href="${demande.url_cni}" target="_blank" class="btn btn-sm btn-outline-primary me-1">
                                    <i class="fa-solid fa-id-card"></i> CNI
                                </a>
                                <a href="${demande.url_carte_grise}" target="_blank" class="btn btn-sm btn-outline-primary me-1">
                                    <i class="fa-solid fa-file-invoice"></i> Carte Grise
                                </a>
                                ${demande.url_permis ? `
                                    <a href="${demande.url_permis}" target="_blank" class="btn btn-sm btn-outline-secondary">
                                        <i class="fa-solid fa-car"></i> Permis
                                    </a>
                                ` : ''}
                            </td>
                            <td>
                                <span class="badge bg-warning text-dark">${demande.statut_demande || 'En attente'}</span>
                            </td>
                            <td>En attente de traitement</td> </tr>
                    `;
                });

            } else {
                alert(`Erreur Backend : ${data.message}`);
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des demandes EN ATTENTES:', error);
        }
    }
}

afficherDemandes_en_attente();


// const suivi_demandes_valides_button = document.getElementById('suivi_demandes_valides_button');
// suivi_demandes_valides_button.addEventListener("click",afficherDemandes_valides);


async function afficherDemandes_valides(){
    if (window.location.pathname === '/suivi_demandes' || window.location.href.includes('/suivi_demandes')) {
        try {
            const response = await fetch('/api/demandes/suivi_demandes_valides', {
                method : 'GET',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                const tbody = document.getElementById('liste-demandes');
                if (!tbody) return;

                tbody.innerHTML = '';

                if (!data.demandes || data.demandes.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Aucune demande trouvée.</td></tr>`;
                    return;
                }

                data.demandes.forEach((demande) => {
                    // Formater la date SQL en format lisible (JJ/MM/AAAA)
                    const dateLisible = new Date(demande.date_demande).toLocaleDateString('fr-FR');
                    
                    tbody.innerHTML += `
                        <tr>
                            <td>${dateLisible}</td>
                            <td>${demande.heure_demande || '-'}</td>
                             <td>
                                <a href="${demande.url_cni}" target="_blank" class="btn btn-sm btn-outline-primary me-1">
                                    <i class="fa-solid fa-id-card"></i> CNI
                                </a>
                                <a href="${demande.url_carte_grise}" target="_blank" class="btn btn-sm btn-outline-primary me-1">
                                    <i class="fa-solid fa-file-invoice"></i> Carte Grise
                                </a>
                                ${demande.url_permis ? `
                                    <a href="${demande.url_permis}" target="_blank" class="btn btn-sm btn-outline-secondary">
                                        <i class="fa-solid fa-car"></i> Permis
                                    </a>
                                ` : ''}
                            </td>
                            <td>
                                <span class="badge bg-primary text-light">${demande.statut_demande || 'En attente'}</span>
                            </td>
                            <td>En attente de traitement</td> </tr>
                    `;
                });

            } else {
                alert(`Erreur Backend : ${data.message}`);
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des demandes VALIDES :', error);
        }
    }
}


// const suivi_demandes_rejetes_button = document.getElementById('suivi_demandes_rejetes_button');
// suivi_demandes_rejetes_button.addEventListener("click",afficherDemandes_rejetes);

async function afficherDemandes_rejetes(){
    if (window.location.pathname === '/suivi_demandes' || window.location.href.includes('/suivi_demandes')) {
        try {
            const response = await fetch('/api/demandes/suivi_demandes_rejetes', {
                method : 'GET',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                const tbody = document.getElementById('liste-demandes');
                if (!tbody) return;

                tbody.innerHTML = '';

                if (!data.demandes || data.demandes.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Aucune demande trouvée.</td></tr>`;
                    return;
                }

                data.demandes.forEach((demande) => {
                    // Formater la date SQL en format lisible (JJ/MM/AAAA)
                    const dateLisible = new Date(demande.date_demande).toLocaleDateString('fr-FR');
                    
                    tbody.innerHTML += `
                        <tr>
                            <td>${dateLisible}</td>
                            <td>${demande.heure_demande || '-'}</td>
                             <td>
                                <a href="${demande.url_cni}" target="_blank" class="btn btn-sm btn-outline-primary me-1">
                                    <i class="fa-solid fa-id-card"></i> CNI
                                </a>
                                <a href="${demande.url_carte_grise}" target="_blank" class="btn btn-sm btn-outline-primary me-1">
                                    <i class="fa-solid fa-file-invoice"></i> Carte Grise
                                </a>
                                ${demande.url_permis ? `
                                    <a href="${demande.url_permis}" target="_blank" class="btn btn-sm btn-outline-secondary">
                                        <i class="fa-solid fa-car"></i> Permis
                                    </a>
                                ` : ''}
                            </td>
                            <td>
                                <span class="badge bg-danger text-light">${demande.statut_demande || 'En attente'}</span>
                            </td>
                            <td>En attente de traitement</td> </tr>
                    `;
                });

            } else {
                alert(`Erreur Backend : ${data.message}`);
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des demandes REJETES :', error);
        }
    }
}

async function afficher_nb_demandes (){
    if (window.location.pathname === '/accueil' || window.location.href.includes('/accueil')){
        try {
            const response = await fetch('/api/demandes/nb_demandes',{
                method : 'GET',
                headers : getAuthHeaders(),
            })
    
            const data = await response.json();
    
            if(data.success){
                // alert(`Nombre de demandes total : ${data.nb_demandes.nb_demandes}`);
                document.getElementById("nb_demandes").innerHTML = data.nb_demandes.nb_demandes;
            }else{
                alert('Erreur ' + data.message)
            } 
        } catch (error) {
            console.log(`Erreur lors de l'affichage du nombre de demandes : ` +error)    
        }
    }
}

afficher_nb_demandes();




async function afficher_nb_demandes_valides (){
    if (window.location.pathname === '/accueil' || window.location.href.includes('/accueil')){
        try {
            const response = await fetch('/api/demandes/nb_demandes_valides',{
                method : 'GET',
                headers : getAuthHeaders(),
            })
    
            const data = await response.json();
    
            if(data.success){
                // alert(`Nombre de demandes valides: ${data.nb_demandes_valides.nb_demandes_valides}`);
                document.getElementById("nb_demandes_valides").innerHTML = data.nb_demandes_valides.nb_demandes_valides;
            }else{
                alert('Erreur ' + data.message)
                console.log(data.message);
            } 
        } catch (error) {
            console.log(`Erreur lors de l'affichage du nombre de demandes : ` +error)    
        }
    }
}

afficher_nb_demandes_valides();



async function afficher_nb_demandes_rejetes (){
    if (window.location.pathname === '/accueil' || window.location.href.includes('/accueil')){
        try {
            const response = await fetch('/api/demandes/nb_demandes_rejetes',{
                method : 'GET',
                headers : getAuthHeaders(),
            })
    
            const data = await response.json();
    
            if(data.success){
                // alert(`Nombre de demandes rejetes : ${data.nb_demandes_rejetes.nb_demandes_rejetes}`);
                document.getElementById("nb_demandes_rejetes").innerHTML = data.nb_demandes_rejetes.nb_demandes_rejetes;
            }else{
                alert('Erreur ' + data.message)
                console.log(data.message);
            } 
        } catch (error) {
            console.log(`Erreur lors de l'affichage du nombre de demandes : ` +error)    
        }
    }
}

afficher_nb_demandes_rejetes();


// AFFECTER UNE FONCTION pour afficher les infosdu profil !1 J'AI DEJA FAIT LES AUTRE FICHIERS JS

async function afficher_infos_profil() {
    try {
        const response = await fetch("/api/profil/afficherprofil", {
            method: 'GET',
            headers: getAuthHeaders()
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

            alert("PROFIL !")
            

        } else {
            console.log("Erreur lors de la récupération :", data.message);
        }
    } catch (error) {
        console.log("Erreur réseau profil :", error);
    }
}


// Ne pas oublier d'appeler la fonction au chargement si on est sur la page profil
if (window.location.pathname.includes('/profil')) {
    console.log("Page profil détectée, lancement de ...");;
    afficher_infos_profil();
}


