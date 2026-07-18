// public/js/client/client-dash-nouvelle-demande.js

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-demande');
  const btnSoumettre = document.getElementById('btn-soumettre');

  if (!form || !btnSoumettre) return;

  function afficherMessage(texte, type) {
    let alerte = document.getElementById('demande-message');
    if (!alerte) {
      alerte = document.createElement('div');
      alerte.id = 'demande-message';
      alerte.className = 'mb-4';
      form.parentElement.insertBefore(alerte, form);
    }
    alerte.innerHTML = `<div class="alert alert-${type} mb-0">${texte}</div>`;
  }

  btnSoumettre.addEventListener('click', async () => {
    const inputCni = document.getElementById('input-cni');
    const inputCarteGrise = document.getElementById('input-carte-grise');
    const inputDuree = document.getElementById('input-duree');

    if (!inputCni?.files.length) {
      afficherMessage('Veuillez sélectionner votre CNI.', 'danger');
      return;
    }
    if (!inputCarteGrise?.files.length) {
      afficherMessage('Veuillez sélectionner votre carte grise.', 'danger');
      return;
    }
    if (!inputDuree?.value) {
      afficherMessage('Veuillez choisir une durée de contrat.', 'danger');
      return;
    }

    // Nettoyage du champ libre "autre garantie" (évite d'envoyer une
    // chaîne composée uniquement d'espaces).
    const inputAutreGarantie = document.getElementById('input-autre-garantie');
    if (inputAutreGarantie) {
      inputAutreGarantie.value = inputAutreGarantie.value.trim();
    }

    // FormData(form) reprend automatiquement tous les champs nommés du
    // formulaire : fichiers, le <select name="duree">, les cases à cocher
    // "garanties" (une entrée par case cochée), le champ libre
    // "autre_garantie" et la case "vignette_payee" (absente si décochée).
    const donnees = new FormData(form);

    btnSoumettre.disabled = true;
    const contenuInitial = btnSoumettre.innerHTML;
    btnSoumettre.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Envoi en cours...';

    try {
      const reponse = await fetch('/api/demandes/nouvelledemande', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: donnees,
      });

      const data = await reponse.json();

      if (!reponse.ok || !data.success) {
        throw new Error(data.message || `Erreur serveur (${reponse.status})`);
      }

      afficherMessage('Votre demande a bien été envoyée. Vous pouvez suivre son statut dans "Suivi demandes".', 'success');
      form.reset();

    } catch (erreur) {
      console.error('[Nouvelle demande] Erreur :', erreur);
      afficherMessage(`Impossible d'envoyer votre demande : ${erreur.message}`, 'danger');
    } finally {
      btnSoumettre.disabled = false;
      btnSoumettre.innerHTML = contenuInitial;
    }
  });
});