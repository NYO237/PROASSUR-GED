// Tout en haut de ton fichier auth-login.js (côté navigateur)
localStorage.removeItem('token'); 
// Note : 'removeItem' est plus propre que de mettre une chaîne vide ''

masquerToutesLesAlertes();

// --- Références DOM : inscription ---
const nom_input_sign_in = document.getElementById("nom_inscription");
const prenom_input_sign_in = document.getElementById("prenom_inscription");
const identifiant_input_sign_in = document.getElementById("identifiant_inscription");
const tel_input_sign_in = document.getElementById("tel_inscription");
const mdp_input_sign_in = document.getElementById("mdp_inscription");
const adresse_input_sign_in = document.getElementById("adresse_inscription");
const sexe_input_sign_in = document.getElementById("sexe_inscription");
const inscription_btn = document.getElementById("inscription_btn");
const login_link = document.getElementById("inscription_link");
const serveur_alert_inscription = document.getElementById("serveur_alert_inscription");
const serveur_alert_inscription_container = document.getElementById("serveur_alert_inscription_container");

const nom_alert_inscription = document.getElementById("nom_alert_inscription");
const prenom_alert_inscription = document.getElementById("prenom_alert_inscription");
const identifiant_alert_inscription = document.getElementById("identifiant_alert_inscription");
const tel_alert_inscription = document.getElementById("tel_alert_inscription");
const mdp_alert_inscription = document.getElementById("mdp_alert_inscription");
const adresse_alert_inscription = document.getElementById("adresse_alert_inscription");
const sexe_alert_inscription = document.getElementById("sexe_alert_inscription");


// --- Utilitaires UI ---
function masquerToutesLesAlertes() {
  document.querySelectorAll(".alert").forEach((el) => {
    el.innerHTML = "";
    el.className = "alert alert-danger mt-1 d-none";
  });
}

// function afficherErreurServeur(message) {
//   serveur_alert_inscription_container.style.display = 'block'
//   serveur_alert_inscription.innerHTML = message;
// }

function afficherErreurServeur(message) {
  if (serveur_alert_inscription_container && serveur_alert_inscription) {
    // 1. On affiche le conteneur principal
    serveur_alert_inscription_container.style.display = 'block';
    
    // 2. On retire les classes d-none sur le conteneur ET sur l'alerte elle-même
    serveur_alert_inscription_container.classList.remove('d-none');
    serveur_alert_inscription.classList.remove('d-none');
    
    // 3. On injecte le message d'erreur
    serveur_alert_inscription.innerHTML = message;
  } else {
    alert(message);
  }
}

async function envoyerAuServeur(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return { response, data };
}

// --- Bascule inscription / connexion ---
// login_link.addEventListener("click", (e) => {
//   e.preventDefault();
//   masquerToutesLesAlertes();
//   bloc_inscription.classList.add("d-none");
//   bloc_connexion.classList.remove("d-none");
// });

// connexion_link_back.addEventListener("click", (e) => {
//   e.preventDefault();
//   masquerToutesLesAlertes();
//   bloc_connexion.classList.add("d-none");
//   bloc_inscription.classList.remove("d-none");
// });

// --- Validations inscription (côté client, pour l'UX) ---
function verifierNom() {
  if (nom_input_sign_in.value === "") {
    nom_alert_inscription.innerHTML = "Veuillez saisir un nom";
    nom_alert_inscription.className = "alert alert-danger mt-1";
    nom_input_sign_in.className = "form-control border border-danger";
    return false;
  }
  nom_alert_inscription.innerHTML = "";
  nom_alert_inscription.className = "alert alert-danger mt-1 d-none";
  nom_input_sign_in.className = "form-control border border-success";
  return true;
}

function verifierPrenom() {
  if (prenom_input_sign_in.value === "") {
    prenom_alert_inscription.innerHTML = "Veuillez saisir un prénom";
    prenom_alert_inscription.className = "alert alert-danger mt-1";
    prenom_input_sign_in.className = "form-control border border-danger";
    return false;
  }
  prenom_alert_inscription.innerHTML = "";
  prenom_alert_inscription.className = "alert alert-danger mt-1 d-none";
  prenom_input_sign_in.className = "form-control border border-success";
  return true;
}

function verifierIdentifiant() {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (identifiant_input_sign_in.value === "") {
    identifiant_alert_inscription.innerHTML = "Veuillez saisir un identifiant (email)";
    identifiant_alert_inscription.className = "alert alert-danger mt-1";
    identifiant_input_sign_in.className = "form-control border border-danger";
    return false;
  }
  if (!emailRegex.test(identifiant_input_sign_in.value)) {
    identifiant_alert_inscription.innerHTML = "Le format de l'email est incorrect (ex: nom@gmail.com)";
    identifiant_alert_inscription.className = "alert alert-danger mt-1";
    identifiant_input_sign_in.className = "form-control border border-danger";
    return false;
  }
  identifiant_alert_inscription.innerHTML = "";
  identifiant_alert_inscription.className = "alert alert-danger mt-1 d-none";
  identifiant_input_sign_in.className = "form-control border border-success";
  return true;
}

function verifierTelephone() {
  const telRegex = /^[0-9]{9}$/;
  if (tel_input_sign_in.value === "") {
    tel_alert_inscription.innerHTML = "Veuillez saisir un numéro de téléphone";
    tel_alert_inscription.className = "alert alert-danger mt-1";
    tel_input_sign_in.className = "form-control border border-danger";
    return false;
  }
  if (!telRegex.test(tel_input_sign_in.value)) {
    tel_alert_inscription.innerHTML = "Le numéro WhatsApp doit contenir exactement 9 chiffres (ex: 672744558)";
    tel_alert_inscription.className = "alert alert-danger mt-1";
    tel_input_sign_in.className = "form-control border border-danger";
    return false;
  }
  tel_alert_inscription.innerHTML = "";
  tel_alert_inscription.className = "alert alert-danger mt-1 d-none";
  tel_input_sign_in.className = "form-control border border-success";
  return true;
}

function verifierMotDePass() {
  const mdpValue = mdp_input_sign_in.value;
  const alphaNumericRegex = /^[a-zA-Z0-9]+$/;
  if (mdpValue === "") {
    mdp_alert_inscription.innerHTML = "Veuillez saisir un mot de passe";
    mdp_alert_inscription.className = "alert alert-danger mt-1";
    mdp_input_sign_in.className = "form-control border border-danger";
    return false;
  }
  if (mdpValue.length <= 6) {
    mdp_alert_inscription.innerHTML = "Le mot de passe doit être supérieur à 6 caractères";
    mdp_alert_inscription.className = "alert alert-danger mt-1";
    mdp_input_sign_in.className = "form-control border border-danger";
    return false;
  }
  if (!alphaNumericRegex.test(mdpValue)) {
    mdp_alert_inscription.innerHTML = "Le mot de passe ne doit pas contenir de caractères spéciaux (uniquement lettres et chiffres)";
    mdp_alert_inscription.className = "alert alert-danger mt-1";
    mdp_input_sign_in.className = "form-control border border-danger";
    return false;
  }
  mdp_alert_inscription.innerHTML = "";
  mdp_alert_inscription.className = "alert alert-danger mt-1 d-none";
  mdp_input_sign_in.className = "form-control border border-success";
  return true;
}

function verifierAdresse() {
  if (adresse_input_sign_in.value === "") {
    adresse_alert_inscription.innerHTML = "Veuillez saisir votre adresse de résidence";
    adresse_alert_inscription.className = "alert alert-danger mt-1";
    adresse_input_sign_in.className = "form-control border border-danger";
    return false;
  }
  adresse_alert_inscription.innerHTML = "";
  adresse_alert_inscription.className = "alert alert-danger mt-1 d-none";
  adresse_input_sign_in.className = "form-control border border-success";
  return true;
}

function verifierSexe() {
  if (sexe_input_sign_in.value === "") {
    sexe_alert_inscription.innerHTML = "Veuillez sélectionner votre sexe";
    sexe_alert_inscription.className = "alert alert-danger mt-1";
    sexe_input_sign_in.className = "form-select border border-danger";
    return false;
  }
  sexe_alert_inscription.innerHTML = "";
  sexe_alert_inscription.className = "alert alert-danger mt-1 d-none";
  sexe_input_sign_in.className = "form-select border border-success";
  return true;
}

async function validerFormulaireInscription(e) {
  e.preventDefault();

  const formulaireValide =
    verifierNom() &&
    verifierPrenom() &&
    verifierIdentifiant() &&
    verifierTelephone() &&
    verifierMotDePass() &&
    verifierAdresse() &&
    verifierSexe();

  if (!formulaireValide) {
    alert("Le formulaire contient des erreurs. Veuillez vérifier les champs en rouge.");
    return;
  }

  try {
    inscription_btn.disabled = true;
    inscription_btn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      Inscription en cours...
    `;

    const { data } = await envoyerAuServeur("/api/auth/register", {
      nom: nom_input_sign_in.value.trim(),
      prenom: prenom_input_sign_in.value.trim(),
      email: identifiant_input_sign_in.value.trim(),
      tel: tel_input_sign_in.value.trim(),
      password: mdp_input_sign_in.value,
      adresse: adresse_input_sign_in.value.trim(),
      sexe: sexe_input_sign_in.value,
    });

    if (!data.success) {
      afficherErreurServeur(data.message || "Inscription refusée.");
      return;
    }

    alert(data.message);
    masquerToutesLesAlertes();
    bloc_inscription.classList.add("d-none");
  } catch (error) {
    console.error(error);
    afficherErreurServeur("Impossible de contacter le serveur. Vérifiez que Express est démarré.");
  } finally {
    inscription_btn.disabled = false;
    inscription_btn.textContent = "S'inscrire";
  }
}



inscription_btn.addEventListener("click", validerFormulaireInscription);


