// public/js/employe/employe-dash-etat-production.js

const choixSemaine        = document.getElementById("choix-semaine");
const affichageDates       = document.getElementById("affichage-dates-semaine");
const btnAfficher          = document.getElementById("btn-afficher-production");
const btnGenerer           = document.getElementById("btn-generer-production");
const tbody                = document.querySelector("#zone-donnees-production tbody");

function formaterDateLisible(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Met à jour le badge "Période correspondante" quand on choisit une semaine
choixSemaine.addEventListener("change", () => {
  if (!choixSemaine.value) return;

  const [annee, semaine] = choixSemaine.value.split("-W").map(Number);
  const janvier4 = new Date(annee, 0, 4);
  const jourSemaineJanvier4 = janvier4.getDay() || 7;
  const lundiSemaine1 = new Date(janvier4);
  lundiSemaine1.setDate(janvier4.getDate() - jourSemaineJanvier4 + 1);

  const lundi = new Date(lundiSemaine1);
  lundi.setDate(lundiSemaine1.getDate() + (semaine - 1) * 7);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);

  affichageDates.textContent = `Du ${formaterDateLisible(lundi)} au ${formaterDateLisible(dimanche)}`;
});

function afficherLignes(lignes, periode) {
  // Insère ou met à jour le titre au-dessus du tableau
  let titre = document.getElementById("titre-rapport-production");
  if (!titre) {
    titre = document.createElement("h6");
    titre.id = "titre-rapport-production";
    titre.className = "fw-bold text-dark mb-3";
    document.getElementById("zone-donnees-production").prepend(titre);
  }
  if (periode) {
    titre.textContent = `Rapport de production du ${formaterDateLisible(periode.debut)} au ${formaterDateLisible(periode.fin)}`;
  }

  tbody.innerHTML = "";

  if (lignes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center text-secondary py-4">
          Aucune production trouvée pour cette semaine.
        </td>
      </tr>`;
    return;
  }

  lignes.forEach((ligne) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-bold">${ligne.numero_police}</td>
      <td>${ligne.nom_prenom}</td>
      <td>${ligne.date_emission}</td>
      <td>${ligne.date_effet}</td>
      <td>${ligne.date_echeance}</td>
      <td>${ligne.num_carte_rose}</td>
      <td>${ligne.num_attestation}</td>
      <td>${Number(ligne.tva).toLocaleString("fr-FR")}</td>
      <td>${Number(ligne.carte_rose).toLocaleString("fr-FR")}</td>
      <td>${ligne.prime_totale ? Number(ligne.prime_totale).toLocaleString("fr-FR") : '-'}</td>
      <td></td>
    `;
    tbody.appendChild(tr);
  });
}

async function chargerProduction() {
  if (!choixSemaine.value) {
    alert("Veuillez sélectionner une semaine.");
    return;
  }

  const texteOriginal = btnAfficher.innerHTML;
  btnAfficher.disabled = true;
  btnAfficher.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Chargement...`;

  try {
    const response = await fetch(`/api/production/semaine?semaine=${choixSemaine.value}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await response.json();

    if (!data.success) {
      alert(data.message || "Erreur lors du chargement.");
      return;
    }

    afficherLignes(data.lignes, data.periode);
  } catch (error) {
    console.error(error);
    alert("Impossible de contacter le serveur.");
  } finally {
    btnAfficher.disabled = false;
    btnAfficher.innerHTML = texteOriginal;
  }
}

async function exporterExcel() {
  if (!choixSemaine.value) {
    alert("Veuillez sélectionner une semaine avant d'exporter.");
    return;
  }

  const texteOriginal = btnGenerer.innerHTML;
  btnGenerer.disabled = true;
  btnGenerer.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Génération...`;

  try {
    const response = await fetch(`/api/production/export?semaine=${choixSemaine.value}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });

    if (!response.ok) {
      alert("Erreur lors de la génération du fichier Excel.");
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `production_${choixSemaine.value}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    alert("Impossible de générer le fichier Excel.");
  } finally {
    btnGenerer.disabled = false;
    btnGenerer.innerHTML = texteOriginal;
  }
}

btnAfficher.addEventListener("click", chargerProduction);
btnGenerer.addEventListener("click", exporterExcel);