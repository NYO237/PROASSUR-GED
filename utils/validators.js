const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_REGEX = /^[0-9]{9}$/;
const PASSWORD_REGEX = /^[a-zA-Z0-9]+$/;

function isNonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function validateEmail(email) {
  if (!isNonEmpty(email)) return 'Veuillez saisir un identifiant (email)';
  if (!EMAIL_REGEX.test(email.trim())) return 'Le format de l\'email est incorrect (ex: nom@gmail.com)';
  return null;
}

function validateTel(tel) {
  if (!isNonEmpty(tel)) return 'Veuillez saisir un numéro de téléphone';
  if (!TEL_REGEX.test(tel.trim())) return 'Le numéro WhatsApp doit contenir exactement 9 chiffres (ex: 672744558)';
  return null;
}

function validatePassword(password) {
  if (!isNonEmpty(password)) return 'Veuillez saisir un mot de passe';
  if (password.length <= 6) return 'Le mot de passe doit être supérieur à 6 caractères';
  if (!PASSWORD_REGEX.test(password)) return 'Le mot de passe ne doit pas contenir de caractères spéciaux (uniquement lettres et chiffres)';
  return null;
}

function validateInscription(data) {
  const errors = {};

  if (!isNonEmpty(data.nom)) errors.nom = 'Veuillez saisir un nom';
  if (!isNonEmpty(data.prenom)) errors.prenom = 'Veuillez saisir un prénom';

  const emailError = validateEmail(data.email);
  if (emailError) errors.email = emailError;

  const telError = validateTel(data.tel);
  if (telError) errors.tel = telError;

  const passwordError = validatePassword(data.password);
  if (passwordError) errors.password = passwordError;

  if (!isNonEmpty(data.adresse)) errors.adresse = 'Veuillez saisir votre adresse de résidence';
  if (!['M', 'F'].includes(data.sexe)) errors.sexe = 'Veuillez sélectionner votre sexe';

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

function validateLogin(data) {
  const errors = {};

  const emailError = validateEmail(data.email);
  if (emailError) errors.email = emailError;

  const telError = validateTel(data.tel);
  if (telError) errors.tel = telError;

  const passwordError = validatePassword(data.password);
  if (passwordError) errors.password = passwordError;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

module.exports = {
  validateInscription,
  validateLogin,
};
