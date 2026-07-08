-- =================================================================
-- 1. SYSTEME D'AUTHENTIFICATION & ACTEURS (Héritage Utilisateur)
-- =================================================================
USE railway;
-- Table Mère : Utilisateur
CREATE TABLE utilisateur (
    id_utilisateur INT AUTO_INCREMENT PRIMARY KEY,
    libelle VARCHAR(50) NOT NULL -- 'client' ou 'employe'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table Fille : Client
CREATE TABLE client (
    id_utilisateur INT PRIMARY KEY,
    nom VARCHAR(50) NOT NULL,
    prenom VARCHAR(50),
    telephone_whatsapp VARCHAR(50) NOT NULL,
    identifiant VARCHAR(50) NOT NULL UNIQUE,
    mdp VARCHAR(255) NOT NULL, -- Taille de 255 nécessaire pour le hachage (bcrypt)
    date_inscription DATE NOT NULL,
    sexe ENUM('m', 'f'),
    adresse VARCHAR(50),
    CONSTRAINT fk_client_utilisateur FOREIGN KEY (id_utilisateur) 
        REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table Fille : Employe
CREATE TABLE employe (
    id_utilisateur INT PRIMARY KEY,
    nom VARCHAR(50) NOT NULL,
    prenom VARCHAR(50),
    identifiant VARCHAR(50) NOT NULL UNIQUE,
    mdp VARCHAR(255) NOT NULL,
    CONSTRAINT fk_employe_utilisateur FOREIGN KEY (id_utilisateur) 
        REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =================================================================
-- 2. WORKFLOW RELATION CLIENT & DEMANDES
-- =================================================================

-- Table Demande de Contrat (Documents Cloudinary)
CREATE TABLE demande_contrat (
    id_demande INT AUTO_INCREMENT PRIMARY KEY,
    date_demande DATE NOT NULL,
    heure_demande TIME NOT NULL,
    statut_demande VARCHAR(50) NOT NULL DEFAULT 'En attente', -- 'En attente', 'En cours', 'Traité'
    url_cni VARCHAR(255) NOT NULL, -- Stockage de l'URL Cloudinary Option B
    url_permis VARCHAR(255),
    url_carte_grise VARCHAR(255) NOT NULL,
    id_client INT NOT NULL,
    id_employe INT DEFAULT NULL, -- NULL tant qu'un agent n'a pas pris en charge la demande
    CONSTRAINT fk_demande_client FOREIGN KEY (id_client) 
        REFERENCES client(id_utilisateur) ON DELETE CASCADE,
    CONSTRAINT fk_demande_employe FOREIGN KEY (id_employe) 
        REFERENCES employe(id_utilisateur) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =================================================================
-- 3. GESTION ADMINISTRATIVE ORASS (Dossier & Risques)
-- =================================================================

-- Table Assuré (Identité officielle sur le contrat physique)
CREATE TABLE assure (
    id_assure INT AUTO_INCREMENT PRIMARY KEY,
    niu VARCHAR(50) DEFAULT NULL, -- Numéro d'Identifiant Unique (Cameroun)
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100),
    profession VARCHAR(50),
    activite VARCHAR(50),
    date_nais DATE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table Véhicule
CREATE TABLE vehicule (
    id_vehicule INT AUTO_INCREMENT PRIMARY KEY,
    categorie VARCHAR(50) NOT NULL, -- ex: CAT 1
    marque VARCHAR(50) NOT NULL,
    modele VARCHAR(50),
    nb_place INT NOT NULL,
    date_mec DATE, -- Date de mise en circulation
    numero_chassis VARCHAR(100) NOT NULL UNIQUE,
    puissance INT,
    cylindre INT,
    energie VARCHAR(50), -- ex: ESSENCE, DIESEL
    nom_conducteur VARCHAR(50),
    prenom_conducteur VARCHAR(50),
    immatriculation VARCHAR(50) NOT NULL UNIQUE,
    id_assure INT NOT NULL,
    CONSTRAINT fk_vehicule_assure FOREIGN KEY (id_assure) 
        REFERENCES assure(id_assure) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =================================================================
-- 4. GESTION DES DOCUMENTS SPECIALISES (Héritage Document ORASS)
-- =================================================================

-- Table Mère : Document
CREATE TABLE document (
    id_document INT AUTO_INCREMENT PRIMARY KEY,
    libelle VARCHAR(100) NOT NULL, -- ex: 'Avenant de renouvellement'
    date_importation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_employe INT NOT NULL, -- L'employé qui a importé le PDF via l'application
    CONSTRAINT fk_document_employe FOREIGN KEY (id_employe) 
        REFERENCES employe(id_utilisateur) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table Fille : Contrat
CREATE TABLE contrat (
    id_document INT PRIMARY KEY,
    code_bureau VARCHAR(10) NOT NULL, -- ex: '2012' (Isole le bureau)
    adresse_bureau VARCHAR(100),
    num_police VARCHAR(50) NOT NULL, -- ex: '1001009464' (Isolé du code bureau)
    date_contrat DATE,
    date_effet DATE NOT NULL,
    date_echeance DATE NOT NULL,
    duree INT NOT NULL, -- Durée en mois
    type_contrat VARCHAR(50), -- ex: 'Avenant', 'Affaire Nouvelle'
    statut_validation VARCHAR(50) NOT NULL DEFAULT 'Brouillon', -- 'Brouillon' (Sauvegardé) ou 'Valide_Production'
    id_vehicule INT NOT NULL,
    -- Contrainte d'unicité sur le couple bureau et numéro de police
    CONSTRAINT uq_bureau_police UNIQUE (code_bureau, num_police),
    CONSTRAINT fk_contrat_document FOREIGN KEY (id_document) 
        REFERENCES document(id_document) ON DELETE CASCADE,
    CONSTRAINT fk_contrat_vehicule FOREIGN KEY (id_vehicule) 
        REFERENCES vehicule(id_vehicule) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table Fille : Quittance
CREATE TABLE quittance (
    id_document INT PRIMARY KEY,
    num_quittance VARCHAR(50) NOT NULL UNIQUE,
    prime_totale DECIMAL(15,2) NOT NULL, -- Changé en (15,2) idéal pour les montants financiers en FCFA
    CONSTRAINT fk_quittance_document FOREIGN KEY (id_document) 
        REFERENCES document(id_document) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table Fille : Carte Rose
CREATE TABLE carte_rose (
    id_document INT PRIMARY KEY,
    num_carte_rose VARCHAR(50) NOT NULL UNIQUE,
    CONSTRAINT fk_carterose_document FOREIGN KEY (id_document) 
        REFERENCES document(id_document) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table Fille : Attestation (Carte Bleue)
CREATE TABLE attestation (
    id_document INT PRIMARY KEY,
    num_attestation VARCHAR(50) NOT NULL UNIQUE,
    CONSTRAINT fk_attestation_document FOREIGN KEY (id_document) 
        REFERENCES document(id_document) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =================================================================
-- 5. VENTILATION FINANCIÈRE, TARIFS & GARANTIES
-- =================================================================

-- Table Réductions et Majorations (Liée au document parent)
CREATE TABLE reductions_majorations (
    id_rm INT AUTO_INCREMENT PRIMARY KEY,
    red_status_socio_prof DECIMAL(15,2) DEFAULT 0.00,
    bonus DECIMAL(15,2) DEFAULT 0.00,
    red_duree_cond DECIMAL(15,2) DEFAULT 0.00,
    maj_mat_infl DECIMAL(15,2) DEFAULT 0.00,
    reductions DECIMAL(15,2) DEFAULT 0.00,
    total_reductions DECIMAL(15,2) DEFAULT 0.00,
    id_document INT NOT NULL,
    CONSTRAINT fk_rm_document FOREIGN KEY (id_document) 
        REFERENCES document(id_document) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table Prime (Décomposition des taxes de la zone CIMA)
CREATE TABLE prime (
    id_prime INT AUTO_INCREMENT PRIMARY KEY,
    prime_nette DECIMAL(15,2) NOT NULL,
    accessoires DECIMAL(15,2) DEFAULT 0.00,
    dta DECIMAL(15,2) DEFAULT 0.00, -- Droits Tondu Automobile
    carte_rose DECIMAL(15,2) DEFAULT 0.00,
    fc_automobile DECIMAL(15,2) DEFAULT 0.00, -- Fonds de Garantie Automobile
    tva DECIMAL(15,2) DEFAULT 0.00,
    prime_totale DECIMAL(15,2) NOT NULL,
    id_document INT NOT NULL,
    CONSTRAINT fk_prime_document FOREIGN KEY (id_document) 
        REFERENCES document(id_document) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table Garantie (Lignes du tableau des risques)
CREATE TABLE garantie (
    id_garantie INT AUTO_INCREMENT PRIMARY KEY,
    libelle VARCHAR(100) NOT NULL, -- ex: 'Responsabilité Civile'
    capital DECIMAL(15,2) DEFAULT NULL, -- Peut être NULL si pas de plafond spécifié
    franchise_limite VARCHAR(100),
    prime_periode DECIMAL(15,2) NOT NULL,
    id_document INT NOT NULL,
    CONSTRAINT fk_garantie_document FOREIGN KEY (id_document) 
        REFERENCES document(id_document) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table Capitaux Assurés
CREATE TABLE capital_assure (
    id_capital INT AUTO_INCREMENT PRIMARY KEY,
    libelle VARCHAR(100) NOT NULL, -- ex: 'Valeur à neuf', 'Valeur vénale'
    valeur DECIMAL(15,2) NOT NULL,
    id_document INT NOT NULL,
    CONSTRAINT fk_capital_document FOREIGN KEY (id_document) 
        REFERENCES document(id_document) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;