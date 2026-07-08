# TODO - Scan dossier employé

- [ ] Étudier la structure du scan dossier côté frontend (input dossier, envoi fetch) et backend (routes multer, req.files).
- [x] Confirmer le mismatch exact causant `Aucun fichier détecté` (souvent `inputDossier.files` vide).

- [x] Corriger `public/js/employe/employe-dash-scanner-dossier.js` pour gérer correctement la sélection dossier et filtrer les PDF côté client.

- [x] Ajouter des logs console et un fallback pour afficher la liste des fichiers sélectionnés.

[x] Implémenter la mise à jour des compteurs et du tableau UI à partir de `reponseJson.statistiques` et `reponseJson.lignes`.
[x] Tester : sélectionner un dossier contenant des PDF et vérifier que `req.files` n’est pas vide et que la réponse 200 remplit l’UI.
