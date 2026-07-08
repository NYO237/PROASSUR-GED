-- ================================================================
-- NETTOYAGE BASE DE DONNÉES - Partie documents uniquement
-- Conserve : utilisateur, client, employe, demande_contrat
-- ================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Tables financières et garanties
TRUNCATE TABLE reductions_majorations;
TRUNCATE TABLE prime;
TRUNCATE TABLE garantie;
TRUNCATE TABLE capital_assure;

-- Tables documents spécialisés (filles)
TRUNCATE TABLE contrat;
TRUNCATE TABLE quittance;
TRUNCATE TABLE carte_rose;
TRUNCATE TABLE attestation;

-- Table document mère
TRUNCATE TABLE document;

-- Tables assurés et véhicules
TRUNCATE TABLE vehicule;
TRUNCATE TABLE assure;

SET FOREIGN_KEY_CHECKS = 1;