// public/js/employe/employe-dash-scanner-dossier.js

// COPIE AFFICHAAP=SDCSDCVSD
document.addEventListener("DOMContentLoaded", () => {
  const btnLancerScan = document.getElementById("btn-lancer-scan");
  const inputDossier = document.getElementById("input-dossier");

  // Sélecteurs d'affichage des compteurs de cartes
  const txtContrats = document.getElementById("count-contrats");
  const txtRecettes = document.getElementById("count-recettes");
  const txtCartesRoses = document.getElementById("count-cartes-roses");
  const txtAttestations = document.getElementById("count-attestations");

  // Corps de la table de données
  const corpsTableau = document.getElementById("corps-tableau-donnees");

  if (btnLancerScan) {
    btnLancerScan.addEventListener("click", async () => {
      const fichiers = inputDossier?.files;

      if (!fichiers || fichiers.length === 0) {
        alert("Veuillez sélectionner un fichier PDF à analyser.");
        return;
      }

      // Filtrage des fichiers PDF uniquement
      const pdfsAEnvoyer = Array.from(fichiers).filter(
        (f) =>
          f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
      );

      if (pdfsAEnvoyer.length === 0) {
        alert("Aucun fichier PDF valide n'a été trouvé dans la sélection.");
        return;
      }

      console.log(
        `[ScannerDossier] Envoi de ${pdfsAEnvoyer.length} fichiers pour analyse.`,
      );

      btnLancerScan.disabled = true;
      btnLancerScan.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Analyse IA en cours...`;

      const formData = new FormData();
      pdfsAEnvoyer.forEach((file) => {
        formData.append("fichiers_lot", file);
      });

      try {
        // ✅ Remplace le fetch actuel
        const response = await fetch("/api/scan/executer-scan", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${localStorage.getItem('token')}`
          },
          body: formData,
        });

        // SÉCURITÉ AMÉLIORÉE : On extrait le message JSON du serveur s'il existe
        if (!response.ok) {
          let messageErreur = `Erreur serveur (${response.status})`;


          // ✅ APRÈS
          try {
            const texteErreur = await response.text();
            const jsonErreur = JSON.parse(texteErreur);
            messageErreur = jsonErreur.message || messageErreur;
          } catch (e) {
            console.error("Réponse brute du serveur non-JSON.");
          }

          throw new Error(messageErreur);
        }

        const reponseJson = await response.json();

        if (reponseJson.success) {
          // Stats
          if (reponseJson.statistiques) {
            if (txtContrats)
              txtContrats.textContent = reponseJson.statistiques.contrats ?? 0;
            if (txtRecettes)
              txtRecettes.textContent = reponseJson.statistiques.recettes ?? 0;
            if (txtCartesRoses)
              txtCartesRoses.textContent =
                reponseJson.statistiques.cartes_roses ?? 0;
            if (txtAttestations)
              txtAttestations.textContent =
                reponseJson.statistiques.attestations ?? 0;
          }

          // Table
          if (corpsTableau) {
            corpsTableau.innerHTML = "";

            const lignes = Array.isArray(reponseJson.lignes)
              ? reponseJson.lignes
              : [];
            lignes.forEach((l) => {
              const tr = document.createElement("tr");
              tr.innerHTML = `
                                <td>${l.bureau ?? "-"}</td>
                                <td>${l.numero_police ?? "-"}</td>
                                <td>${l.numero_carte_rose ?? "-"}</td>
                                <td>${l.numero_attestation ?? "-"}</td>
                                <td>${l.nom_client ?? "-"}</td>
                      
                                <td>${l.vehicule ?? "-"}</td>
                                <td>${l.nom_conducteur ?? "-"}</td>
                                
                                <td>${l.prime_nette ?? "0"}</td>
                            `;
              corpsTableau.appendChild(tr);
            });
          }

          const nbIgnores = reponseJson.fichiers_ignores || 0;
          if (reponseJson.lignes && reponseJson.lignes.length === 0 && nbIgnores > 0) {
            alert(reponseJson.message || "Tous les fichiers sélectionnés ont déjà été analysés précédemment.");
          } else if (reponseJson.avertissement_bdd) {
            alert(
              `Les documents ont été analysés, mais l'enregistrement en base de données a échoué :\n${reponseJson.avertissement_bdd}\n\nLe tableau ci-dessous reflète l'analyse, pas ce qui est réellement en base.`
            );
          } else {
            const messageIgnores = nbIgnores > 0
              ? ` (${nbIgnores} fichier${nbIgnores > 1 ? 's' : ''} déjà en base, ignoré${nbIgnores > 1 ? 's' : ''} pour économiser les tokens.)`
              : '';
            alert(`L'ensemble des documents a été scanné avec succès.${messageIgnores}`);
          }
        }
      } catch (err) {
        console.error("Erreur réseau du scanneur :", err);
        // Affichera désormais : "Aucun fichier PDF valide ou lisible n'a été trouvé..."
        alert(
          err.message || "Impossible de joindre le service d'analyse réseau.",
        );
      } finally {
        btnLancerScan.disabled = false;
        btnLancerScan.textContent = "Lancer l'analyse";
      }
    });
  }
});