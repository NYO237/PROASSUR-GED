// Tout en haut de ton fichier auth-login.js (côté navigateur)
localStorage.removeItem('token'); 
// Note : 'removeItem' est plus propre que de mettre une chaîne vide ''

// --- Références DOM : inscription ---

const bloc_connexion = document.getElementById("bloc_connexion");
const connexion_link_back = document.querySelector("a");

// --- Références DOM : connexion ---
const identifiant_input_login = document.getElementById("identifiant_connexion");
const tel_input_login = document.getElementById("tel_connexion");
const mdp_input_login = document.getElementById("mdp_connexion");
const identifiant_alert_connexion = document.getElementById("identifiant_alert_connexion");
const tel_alert_connexion = document.getElementById("tel_alert_connexion");
const mdp_alert_connexion = document.getElementById("mdp_alert_connexion");
const connexion_btn = document.getElementById("connexion_btn");
const serveur_alert_connexion = document.getElementById("serveur_alert_connexion");
const serveur_alert_connexion_container = document.getElementById("serveur_alert_connexion_container");

// --- Utilitaires UI ---
function masquerToutesLesAlertes() {
  document.querySelectorAll(".alert").forEach((el) => {
    el.innerHTML = "";
    el.className = "alert alert-danger mt-1 d-none";
  });
}

// function afficherErreurServeur(message) {
//   alert(message);
// }

function afficherErreurServeur(message) {
  serveur_alert_connexion_container.style.display = 'block'
  serveur_alert_connexion.innerHTML = message;
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



// --- Validations connexion (côté client) ---
function verifierIdentifiantLogin() {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (identifiant_input_login.value === "") {
    identifiant_alert_connexion.innerHTML = "Veuillez saisir un identifiant (email)";
    identifiant_alert_connexion.className = "alert alert-danger mt-1";
    identifiant_input_login.className = "form-control border border-danger";
    return false;
  }
  if (!emailRegex.test(identifiant_input_login.value)) {
    identifiant_alert_connexion.innerHTML = "Le format de l'email est incorrect (ex: nom@gmail.com)";
    identifiant_alert_connexion.className = "alert alert-danger mt-1";
    identifiant_input_login.className = "form-control border border-danger";
    return false;
  }
  identifiant_alert_connexion.innerHTML = "";
  identifiant_alert_connexion.className = "alert alert-danger mt-1 d-none";
  identifiant_input_login.className = "form-control border border-success";
  return true;
}

function verifierTelephoneLogin() {
  const telRegex = /^[0-9]{9}$/;
  if (tel_input_login.value === "") {
    tel_alert_connexion.innerHTML = "Veuillez saisir un numéro de téléphone";
    tel_alert_connexion.className = "alert alert-danger mt-1";
    tel_input_login.className = "form-control border border-danger";
    return false;
  }
  if (!telRegex.test(tel_input_login.value)) {
    tel_alert_connexion.innerHTML = "Le numéro WhatsApp doit contenir exactement 9 chiffres (ex: 672744558)";
    tel_alert_connexion.className = "alert alert-danger mt-1";
    tel_input_login.className = "form-control border border-danger";
    return false;
  }
  tel_alert_connexion.innerHTML = "";
  tel_alert_connexion.className = "alert alert-danger mt-1 d-none";
  tel_input_login.className = "form-control border border-success";
  return true;
}

function verifierMotDePassLogin() {
  const mdpValue = mdp_input_login.value;
  const alphaNumericRegex = /^[a-zA-Z0-9]+$/;
  if (mdpValue === "") {
    mdp_alert_connexion.innerHTML = "Veuillez saisir un mot de passe";
    mdp_alert_connexion.className = "alert alert-danger mt-1";
    mdp_input_login.className = "form-control border border-danger";
    return false;
  }
  if (mdpValue.length <= 6) {
    mdp_alert_connexion.innerHTML = "Le mot de passe doit être supérieur à 6 caractères";
    mdp_alert_connexion.className = "alert alert-danger mt-1";
    mdp_input_login.className = "form-control border border-danger";
    return false;
  }
  if (!alphaNumericRegex.test(mdpValue)) {
    mdp_alert_connexion.innerHTML = "Le mot de passe ne doit pas contenir de caractères spéciaux (uniquement lettres et chiffres)";
    mdp_alert_connexion.className = "alert alert-danger mt-1";
    mdp_input_login.className = "form-control border border-danger";
    return false;
  }
  mdp_alert_connexion.innerHTML = "";
  mdp_alert_connexion.className = "alert alert-danger mt-1 d-none";
  mdp_input_login.className = "form-control border border-success";
  return true;
}

async function validerFormulaireConnexion(e) {
  e.preventDefault();

  const formulaireValide =
    verifierIdentifiantLogin() &&
    verifierTelephoneLogin() &&
    verifierMotDePassLogin();

  if (!formulaireValide) {

    afficherErreurServeur("Le formulaire contient des erreurs. Veuillez vérifier les champs en rouge.")
    return;
  }

  try {
    connexion_btn.disabled = true;
    connexion_btn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      Connexion en cours...
    `;

    const { data } = await envoyerAuServeur("/api/auth/login", {
      email: identifiant_input_login.value.trim(),
      tel: tel_input_login.value.trim(),
      password: mdp_input_login.value,
    });

    if (!data.success) {
      afficherErreurServeur(data.message || "Connexion refusée.");
      return;
    }

    if (data.user) {
      sessionStorage.setItem("proassur_user", JSON.stringify(data.user));
      localStorage.setItem('token',data.token);
      localStorage.setItem('id',data.user.id);
    }

    window.location.href = data.redirect;
  } catch (error) {
    console.error(error);
    afficherErreurServeur("Impossible de contacter le serveur. Vérifiez que Express est démarré.");
  } finally {
    connexion_btn.disabled = false;
    connexion_btn.textContent = "Se connecter";
  }
}



connexion_btn.addEventListener("click", validerFormulaireConnexion);

