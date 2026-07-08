# Intégralité des fonctionnalités du projet (Résumé complet)

> Projet Node.js / Express (serveur) + pages HTML (client) + API JSON pour le front.

## 1) Démarrage du serveur / routage principal

Fichier : **`app.js`**

- Serveur Express avec middlewares :
  - `express.json()`
  - `express.urlencoded({ extended: true })`
- Servit les fichiers statiques :
  - `/js` → `public/js`
  - `/images` (via `express.static('images')`)
  - `/bootstrap-js`, `/bootstrap-css` (depuis `node_modules`)
  - `/css` → `public/css`
- Routes “pages” (envoi HTML) :
  - `/` → `test.html`
  - `/login` → `public/auth/login.html`
  - `/register` → `public/auth/register.html`
  - Section employé :
    - `/demandes_recues` → `public/employe/demandes_recues.html`
    - `/scanner_dossier` → `public/employe/scanner_dossier.html`
    - `/etat_production` → `public/employe/etat_production.html`
    - `/etat_recettes` → `public/employe/etat_recettes.html`
    - `/statistiques` → `public/employe/statistiques.html`
    - `/utilisateurs` → `public/employe/utilisateurs.html`
    - `/contrats` → `public/employe/contrats.html`
    - `/profil_proassur` → `public/employe/profil_proassur.html`
- Routes API (prefixes) :
  - Auth : `/api/auth`
  - Demandes : `/api/demandes`
  - Profil : `/api/profil`
  - Scan dossiers : `/api/scan`
  - Production : `/api/production`
  - Utilisateurs (chef d’agence) : `/api/utilisateurs`
  - Contrats employé : `/api/contrats-employe`
  - Contrats client : `/api/contrats`
  - Rapport journalier : `/api/rapport-journalier`
  - Statistiques : `/api/statistiques`

## 2) Authentification (JWT) & rôle

Fichiers :

- **`routes/authRoutes.js`**
- **`controllers/authController.js`**
- **`middleware/authMiddleware.js`**
- **`services/userService.js`**
- **`public/js/auth-guard.js`** (front)

### 2.1 Inscription

Route : **POST** `/api/auth/register`

- Contrôleur : `controllers/authController.js#register`
- Validation via `utils/validators` (importé dans le contrôleur)
- Logique :
  - vérifie intégrité des champs (nom/prenom/email/tel/password/adresse/sexe)
  - empêche doublon par email
  - crée un **compte client** (`role: 'client'`)

### 2.2 Connexion

Route : **POST** `/api/auth/login`

- Contrôleur : `controllers/authController.js#login`
- Logique :
  - recherche utilisateur par **email + téléphone**
  - empêche accès si `statut_compte === 'suspendu'`
  - vérifie le mot de passe (bcrypt)
  - génère un **JWT RSA (RS256)** via clés:
    - `JWT_PRIVATE_KEY`
    - `JWT_PUBLIC_KEY`
  - payload JWT inclut notamment : `id`, `role`, `estChefAgence`
  - redirection selon rôle :
    - employé → `/demandes_recues`
    - client → `/accueil`

### 2.3 Middleware d’accès

Fichier : **`middleware/authMiddleware.js`**

- `authenticateToken` :
  - attend `Authorization: Bearer <token>`
  - vérifie JWT (`RS256`)
  - met `req.user`
- `requireChefAgence` :
  - autorise si `req.user.role === 'employe' && req.user.estChefAgence`
  - sinon renvoie **403**

### 2.4 Rôles fonctionnels observés

- **client** :
  - soumet des demandes de contrat
  - consulte ses demandes en attente/validées/rejetées
  - consulte ses contrats
- **employé** :
  - traite/suit les demandes (validation/rejet)
  - scanne des dossiers (PDF) et enregistre les données en BDD
  - produit : états de production & export Excel
  - recettes : rapport journalier scan & export Excel
  - statistiques
- **chef d’agence** (employé avec `estChefAgence`) :
  - accès à la gestion complète des utilisateurs (CRUD + suspension)

## 3) Gestion des utilisateurs (chef d’agence)

Fichiers :

- **`routes/utilisateursRoutes.js`**
- **`controllers/utilisateursController.js`**
- **`services/utilisateursService.js`**

### 3.1 Routes protégées

- `router.use(authenticateToken, requireChefAgence)`

### 3.2 Fonctionnalités

- **GET** `/api/utilisateurs/afficher_infos_clients`
- **GET** `/api/utilisateurs/afficher_infos_employes`
- **POST** `/api/utilisateurs/creer`
  - crée un utilisateur côté DB en transaction
  - role_type : `client` ou `employe`
  - hash mot de passe bcrypt
  - téléphone WhatsApp requis
  - option `estChefAgence` pour employé : insertion dans `chef_agence`
- **DELETE** `/api/utilisateurs/supprimer/:id`
  - suppression dans table `utilisateur` (cascade)
- **PATCH** `/api/utilisateurs/basculer_status/:id`
  - bascule `status` entre `actif` et `suspendu`
- **PUT** `/api/utilisateurs/modifier/:id`
  - modifie champs (client : nom/prenom/identifiant/adresse/sexe ; employé : nom/prenom/identifiant + téléphone + mdp)
  - gère chef d’agence via insertion/suppression dans `chef_agence`

## 4) Demandes de contrat (Client & Employé)

Fichiers :

- **`routes/demandeRoutes.js`**
- **`controllers/demandeController.js`**
- **`services/demandeService.js`**

### 4.1 Dépôt d’une nouvelle demande

Route : **POST** `/api/demandes/nouvelledemande`

- Auth + upload (multer dest `uploads/`)
- Champs fichiers (max 1 chacun) :
  - `cni`
  - `input-permis` (optionnel)
  - `input-carte-grise`
- Contrôleur `createDemande` :
  - refuse si documents obligatoires manquants
  - refuse si `req.user.role !== 'client'`
  - upload des fichiers vers **Cloudinary** (via `config/cloudinary`) et supprime le fichier local
  - crée une ligne dans `demande_contrat`

### 4.2 Suivi demandes côté client

Routes :

- **GET** `/api/demandes/suivi_demandes_en_attente`
- **GET** `/api/demandes/suivi_demandes_valides`
- **GET** `/api/demandes/suivi_demandes_rejetes`

### 4.3 Traitement demandes côté employé

Routes :

- **GET** `/api/demandes/demandes_recues_en_attente`
- **GET** `/api/demandes/demandes_recues_valides`
- **GET** `/api/demandes/demandes_recues_rejetes`
- **PUT** `/api/demandes/valider_demande`
  - body: `{ id: <idDemande> }`
- **PUT** `/api/demandes/rejeter_demande`
  - body: `{ id: <idDemande>, motif: <motif> }`

### 4.4 Statistiques simples côté client

Routes :

- **GET** `/api/demandes/nb_demandes`
- **GET** `/api/demandes/nb_demandes_valides`
- **GET** `/api/demandes/nb_demandes_rejetes`

## 5) Scan de dossiers (PDF) → Extraction IA → Insertion BDD

Fichiers :

- **`routes/scanRoutes.js`**
- **`controllers/scanController.js`**
- **`services/pdfService.js`**
- **`services/aiService.js`**
- **`services/dbScanService.js`**

### 5.1 Route de scan

**POST** `/api/scan/executer-scan`

- Auth requis
- `multer.memoryStorage()`
- champs : `fichiers_lot` (array)

### 5.2 Fonctionnement détaillé

Contrôleur : `scannerLotDossiers`

- Vérifie présence de fichiers
- Vérifie utilisateur authentifié (`req.user.id`)
- Optimisation anti-doublons :
  - calcule clé `(nom_fichier, taille_fichier)`
  - interroge `document` pour ignorer ceux déjà analysés
- Filtre PDF : `mimetype === application/pdf` ou extension `.pdf`
- Pour chaque PDF :
  1. extraction texte via `pdfService.extraireTextePdf(file.buffer)`
  2. masquage/“anonymisation” via `pdfService.masquerDonneesSensibles`
  3. analyse IA via `aiService.analyserTexteDocument(texteAnonyme)`
  4. parse JSON (suppression éventuelle de `json ... `)
  5. restauration via `pdfService.restaurerDonneesSensibles`
  6. enregistre dans BDD via `dbScanService.sauvegarderLotDocuments`
- Délai entre appels IA : `setTimeout(..., 3000)`

### 5.3 Insertion BDD (dbScanService)

Fonction principale : `sauvegarderLotDocuments(documentsAnalyses, idEmploye)`

- Transaction SQL
- Sépare par type IA :
  - `contrat`
  - `carte rose`
  - `attestation`
- Insère **d’abord** carte rose + attestation (pour lier les contrats ensuite)
- Pour chaque contrat :
  - regroupe via code_bureau/num_police (si num_police présent)
  - rattache FK :
    - priorité : correspondance code/police entre contrat et carte/attestation
    - fallback : immatriculation
  - insertion si contrat absent ; sinon UPDATE des FK manquantes
- Insère/recupère :
  - `vehicule` (identifié par immatriculation)
  - `assure` (nom/prenom)
- Crée et relie :
  - table `document`
  - `carte_rose`, `attestation`
  - `contrat`
  - `prime`
  - `reductions_majorations`

### 5.4 Extraction IA (Groq)

Fichier : `services/aiService.js`

- Utilise `groq-sdk` avec `GROQ_API_KEY`
- prompt strict orienté PROASSUR :
  - règle priorité : attestation > carte rose > contrat/avenant > état recettes > autre
  - extraction : code bureau/num police, dates, assure, véhicule, montant prime/tva/etc.
- `response_format: { type: "json_object" }`

## 6) Contrats (côté client)

Fichiers :

- **`routes/contratclientRoutes.js`**
- **`controllers/contratclientController.js`**
- **`services/Contratclientservice.js`**

### 6.1 Route

**GET** `/api/contrats/mes_contrats`

- Auth requis
- récupère le client connecté (via `req.user.id`)
- requête DB : jointure assure/vehicule/carte_rose/prime/contrat
- calcul statut :
  - `en_attente_effet` si `CURDATE() < date_effet`
  - `en_cours` sinon si avant `date_echeance`
  - `expire` si `CURDATE() > date_echeance`

### 6.2 Output

- Retour JSON séparant :
  - `contrats_en_cours`
  - `contrats_expires`
  - `contrats_en_attente`

## 7) Contrats (côté employé)

Fichiers :

- **`routes/Contratsemployeroutes.js`**
- **`controllers/Contratsemployecontroller.js`**
- **`services/ContratsemployeService.js`** (nom visible : `services/Contratsemployeservice.js`)

### 7.1 Route

**GET** `/api/contrats-employe/rechercher?nom=...`

- Auth requis
- recherche par nom
- renvoie `contrats` (liste)

> Le mécanisme exact de requête dans `ContratsemployeService` n’a pas été ouvert ici, mais la route/controller sont décrits ci-dessus.

## 8) Production (état production) + export Excel

Fichiers :

- **`routes/productionRoutes.js`**
- **`controllers/productionController.js`**
- **`services/productionService.js`**

### 8.1 Routes

- **GET** `/api/production/semaine?semaine=YYYY-Www`
- **GET** `/api/production/export?semaine=YYYY-Www`

### 8.2 Calcul période semaine

- `getDatesSemaine(semaineISO)` convertit `2026-W20` en date début/lundi et date fin/dimanche

### 8.3 Données production

- `productionService.getProductionParSemaine(debut, fin)` :
  - sélectionne contrats dont `date_emission` est dans la période
  - joint assure/vehicule/carte rose/attestation/prime

### 8.4 Export Excel

- Construit workbook ExcelJS avec styles (titres, gris, numéro de formatage)
- Remplit lignes + formate dates, nombres
- Télécharge fichier `production_<debut>_<fin>.xlsx`

## 9) Rapport journalier (recettes)

Fichiers :

- **`routes/rapportJournalierRoutes.js`**
- **`controllers/Rapportjournaliercontroller.js`**
- **`services/rapportJournalierService.js`**
- **`services/aiRapportService.js`**

### 9.1 Routes

- **POST** `/api/rapport-journalier/scan`
  - Auth requise
  - upload :
    - `encaissements` (PDF)
    - `commissions` (PDF optionnel)
  - appelle `scannerRapportJournalier`
- **GET** `/api/rapport-journalier?date=YYYY-MM-DD`
  - récupération rapport par date
- **PATCH** `/api/rapport-journalier/:date`
  - mise à jour manuelle (champs autorisés)
- **GET** `/api/rapport-journalier/export?date=YYYY-MM-DD`
  - export Excel

### 9.2 Scan + insertion

Workflow `scannerRapportJournalier` :

1. extraits date du PDF via `analyserSituationEncaissements`
2. analyse commissions optionnelle via `analyserBordereauCommissions`
3. calcule solde initial :
   - récupère solde final du rapport précédent via `getSoldeFinalVeille(dateRapport)`
4. sauvegarde/upsert via `rapportService.sauvegarderRapport({ ... }, idEmploye)`
   - calcule `solde_final_especes` avec formule
   - calcule `solde_final_cheques`

### 9.3 Mise à jour manuelle

- `mettreAJourLigneManuelle` :
  - fusionne rapport existant + body
  - recalcule soldes
  - met à jour uniquement champs autorisés :
    - `autres_depenses`, `versement_banque`, `versement_compta`,
    - `solde_initial_especes`, `solde_initial_cheques`, `observations`

### 9.4 Export Excel

- ExcelJS :
  - titres stylés + sections (activités, grille)
  - écrit valeurs calculées : espèces, chèques, commissions, versements, soldes
  - export `rapport_journalier_<date>.xlsx`

## 10) Statistiques

Fichiers :

- **`routes/statistiquesRoutes.js`**
- **`controllers/statistiquesController.js`**
- **`services/statistiquesService.js`**

### 10.1 Routes

- **GET** `/api/statistiques/synthese?periode=jour|semaine|mois|tout`
- **GET** `/api/statistiques/evolution?periode=jour|semaine|mois|tout`

### 10.2 Synthèse

- `getCartesSynthese` renvoie :
  - compte contrats (distinct c.id_document)
  - véhicules assurés (id_assure)
  - assurés (id_assure)
  - CA (somme `prime_totale`)
  - demandes
  - évolution % vs période précédente (équivalente)

### 10.3 Évolution (graphique)

- Génère des “buckets” :
  - jour → 14 derniers jours
  - semaine → 12 dernières semaines ISO
  - mois → 12 derniers mois
  - tout → par année
- Calcule :
  - `contrats`, `chiffre_affaires`, `demandes`

## 11) Base de données & schémas SQL

Fichiers visibles :

- **`NettoyageContrat.sql`**
- Répertoire **`bd/`** (beaucoup de scripts `railway_*.sql`)
- **`database/schema.sql`**

> Le schéma complet n’a pas été inclus dans ce fichier MD car la demande porte sur l’“intégralité des fonctionnalités”. Les requêtes SQL sont décrites dans les services ci-dessus.

## 12) Exemples de fonctionnalités Front (pages)

Les pages front existent côté public/ et consomment les API :

- Auth pages :
  - `public/auth/login.html`
  - `public/auth/register.html`
- Client :
  - `public/client/accueil.html`
  - `public/client/nouvelle_demande.html`
  - `public/client/suivi_demandes.html`
  - `public/client/profil.html`
- Employé :
  - `public/employe/scanner_dossier.html`
  - `public/employe/demandes_recues.html`
  - `public/employe/etat_production.html`
  - `public/employe/etat_recettes.html`
  - `public/employe/statistiques.html`
  - `public/employe/utilisateurs.html`
  - `public/employe/contrats.html`
  - `public/employe/profil_proassur.html`

Les JS front visibles suivent généralement le même pattern :

- lecture champs UI
- appel fetch aux routes API
- mise à jour du DOM en fonction des réponses

## 13) Liste des fonctionnalités “par grandes capacités” (checklist)

1. Auth & JWT RSA (RS256)
2. Inscription client
3. Connexion client / employé (email + téléphone)
4. Chef d’agence : gestion CRUD utilisateurs + suspension/réactivation
5. Client : soumission demande avec upload fichiers + Cloudinary
6. Client : consultation demandes (en attente / valides / rejetées) + compteurs
7. Employé : liste demandes et validation/rejet (motif requis au rejet)
8. Employé : scan lot PDF (anti-doublons + extraction texte + IA + insertion BDD)
9. Contrats client : affichage contrats + statuts (en attente effet / en cours / expiré)
10. Contrats employé : recherche contrats par nom
11. Production : état semaine + export Excel
12. Rapport journalier recettes : scan PDFs (encaissements/commissions) + upsert + export Excel
13. Statistiques : synthèse et évolution (jour/semaine/mois/tout)

---

## Notes

- Certaines parties front et scripts supplémentaires peuvent exister (fichiers copy, tests). Les fonctionnalités “API” sont entièrement couvertes par les contrôleurs/services cités ci-dessus.
