-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: zephyr.proxy.rlwy.net    Database: railway
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `demande_contrat`
--

DROP TABLE IF EXISTS `demande_contrat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `demande_contrat` (
  `id_demande` int NOT NULL AUTO_INCREMENT,
  `date_demande` date NOT NULL,
  `heure_demande` time NOT NULL,
  `statut_demande` varchar(50) NOT NULL DEFAULT 'En attente',
  `url_cni` varchar(255) NOT NULL,
  `url_permis` varchar(255) DEFAULT NULL,
  `url_carte_grise` varchar(255) NOT NULL,
  `id_client` int NOT NULL,
  `id_employe` int DEFAULT NULL,
  PRIMARY KEY (`id_demande`),
  KEY `fk_demande_client` (`id_client`),
  KEY `fk_demande_employe` (`id_employe`),
  CONSTRAINT `fk_demande_client` FOREIGN KEY (`id_client`) REFERENCES `client` (`id_utilisateur`) ON DELETE CASCADE,
  CONSTRAINT `fk_demande_employe` FOREIGN KEY (`id_employe`) REFERENCES `employe` (`id_utilisateur`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `demande_contrat`
--

LOCK TABLES `demande_contrat` WRITE;
/*!40000 ALTER TABLE `demande_contrat` DISABLE KEYS */;
/*!40000 ALTER TABLE `demande_contrat` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-11 13:45:08
