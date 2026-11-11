-- Publication copy: schema only; local data rows intentionally excluded.
/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.14-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: 127.0.0.1    Database: barangay_survey_system
-- ------------------------------------------------------
-- Server version	10.11.14-MariaDB-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `barangay_survey_system`
--

/*!40000 DROP DATABASE IF EXISTS `barangay_survey_system`*/;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `barangay_survey_system` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;

USE `barangay_survey_system`;

--
-- Table structure for table `login_history`
--

DROP TABLE IF EXISTS `login_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_history` (
  `log_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_type` enum('resident','staff') NOT NULL,
  `user_id` int(11) NOT NULL,
  `login_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `ip_address` varchar(50) DEFAULT NULL,
  `event` varchar(10) NOT NULL DEFAULT 'login',
  `account_role` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_history`
--

LOCK TABLES `login_history` WRITE;
/*!40000 ALTER TABLE `login_history` DISABLE KEYS */;

/*!40000 ALTER TABLE `login_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resident_character_references`
--

DROP TABLE IF EXISTS `resident_character_references`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `resident_character_references` (
  `reference_id` int(11) NOT NULL AUTO_INCREMENT,
  `resident_id` int(11) NOT NULL,
  `courtesy_title` varchar(20) DEFAULT NULL,
  `last_name` varchar(50) DEFAULT NULL,
  `first_name` varchar(50) DEFAULT NULL,
  `middle_name` varchar(50) DEFAULT NULL,
  `name_extension` varchar(20) DEFAULT NULL,
  `display_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `gender` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`reference_id`),
  KEY `resident_id` (`resident_id`),
  CONSTRAINT `resident_character_references_ibfk_1` FOREIGN KEY (`resident_id`) REFERENCES `residents` (`resident_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resident_character_references`
--

LOCK TABLES `resident_character_references` WRITE;
/*!40000 ALTER TABLE `resident_character_references` DISABLE KEYS */;

/*!40000 ALTER TABLE `resident_character_references` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resident_children`
--

DROP TABLE IF EXISTS `resident_children`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `resident_children` (
  `child_id` int(11) NOT NULL AUTO_INCREMENT,
  `resident_id` int(11) NOT NULL,
  `courtesy_title` varchar(20) DEFAULT NULL,
  `last_name` varchar(50) DEFAULT NULL,
  `first_name` varchar(50) DEFAULT NULL,
  `middle_name` varchar(50) DEFAULT NULL,
  `name_extension` varchar(20) DEFAULT NULL,
  `display_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `gender` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`child_id`),
  KEY `resident_id` (`resident_id`),
  CONSTRAINT `resident_children_ibfk_1` FOREIGN KEY (`resident_id`) REFERENCES `residents` (`resident_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resident_children`
--

LOCK TABLES `resident_children` WRITE;
/*!40000 ALTER TABLE `resident_children` DISABLE KEYS */;

/*!40000 ALTER TABLE `resident_children` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resident_delete_requests`
--

DROP TABLE IF EXISTS `resident_delete_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `resident_delete_requests` (
  `request_id` int(11) NOT NULL AUTO_INCREMENT,
  `resident_id` int(11) NOT NULL,
  `resident_number` varchar(20) DEFAULT NULL,
  `resident_name` varchar(120) DEFAULT NULL,
  `reason` varchar(255) NOT NULL,
  `requested_by` int(11) DEFAULT NULL,
  `requested_by_name` varchar(100) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `requested_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_by_name` varchar(100) DEFAULT NULL,
  `review_comment` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resident_delete_requests`
--

LOCK TABLES `resident_delete_requests` WRITE;
/*!40000 ALTER TABLE `resident_delete_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `resident_delete_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resident_family_requests`
--

DROP TABLE IF EXISTS `resident_family_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `resident_family_requests` (
  `request_id` int(11) NOT NULL AUTO_INCREMENT,
  `resident_id` int(11) NOT NULL,
  `payload` longtext NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `requested_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_by_name` varchar(100) DEFAULT NULL,
  `review_comment` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  KEY `resident_id` (`resident_id`),
  KEY `status` (`status`),
  CONSTRAINT `resident_family_requests_ibfk_1` FOREIGN KEY (`resident_id`) REFERENCES `residents` (`resident_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resident_family_requests`
--

LOCK TABLES `resident_family_requests` WRITE;
/*!40000 ALTER TABLE `resident_family_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `resident_family_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resident_residency_changes`
--

DROP TABLE IF EXISTS `resident_residency_changes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `resident_residency_changes` (
  `change_id` int(11) NOT NULL AUTO_INCREMENT,
  `resident_id` int(11) NOT NULL,
  `from_status` varchar(20) NOT NULL,
  `to_status` varchar(20) NOT NULL,
  `reason` text DEFAULT NULL,
  `changed_by` int(11) DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_reverted` tinyint(1) NOT NULL DEFAULT 0,
  `prev_address` varchar(255) DEFAULT NULL,
  `prev_household_number` varchar(50) DEFAULT NULL,
  `prev_purok` varchar(100) DEFAULT NULL,
  `prev_street_highway` varchar(150) DEFAULT NULL,
  `prev_barangay` varchar(100) DEFAULT NULL,
  `prev_municipality` varchar(100) DEFAULT NULL,
  `prev_postal_code` varchar(10) DEFAULT NULL,
  `prev_province` varchar(100) DEFAULT NULL,
  `prev_temporary_address` varchar(255) DEFAULT NULL,
  `prev_temp_household_number` varchar(50) DEFAULT NULL,
  `prev_temp_purok` varchar(100) DEFAULT NULL,
  `prev_temp_street_highway` varchar(150) DEFAULT NULL,
  `prev_temp_barangay` varchar(100) DEFAULT NULL,
  `prev_temp_municipality` varchar(100) DEFAULT NULL,
  `prev_temp_postal_code` varchar(10) DEFAULT NULL,
  `prev_temp_province` varchar(100) DEFAULT NULL,
  `prev_residence_type` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`change_id`),
  KEY `resident_id` (`resident_id`),
  KEY `changed_at` (`changed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resident_residency_changes`
--

LOCK TABLES `resident_residency_changes` WRITE;
/*!40000 ALTER TABLE `resident_residency_changes` DISABLE KEYS */;
/*!40000 ALTER TABLE `resident_residency_changes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resident_update_requests`
--

DROP TABLE IF EXISTS `resident_update_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `resident_update_requests` (
  `request_id` int(11) NOT NULL AUTO_INCREMENT,
  `resident_id` int(11) NOT NULL,
  `first_name` varchar(50) DEFAULT NULL,
  `last_name` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `household_number` varchar(50) DEFAULT NULL,
  `barangay_subdivision` varchar(100) DEFAULT NULL,
  `municipality` varchar(100) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `review_comment` varchar(255) DEFAULT NULL,
  `temporary_address` varchar(255) DEFAULT NULL,
  `temp_household_number` varchar(50) DEFAULT NULL,
  `temp_purok` varchar(100) DEFAULT NULL,
  `temp_street_highway` varchar(150) DEFAULT NULL,
  `temp_barangay` varchar(100) DEFAULT NULL,
  `temp_municipality` varchar(100) DEFAULT NULL,
  `temp_postal_code` varchar(10) DEFAULT NULL,
  `temp_province` varchar(100) DEFAULT NULL,
  `purok` varchar(100) DEFAULT NULL,
  `street_highway` varchar(150) DEFAULT NULL,
  `barangay` varchar(100) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `previous_address` varchar(255) DEFAULT NULL,
  `courtesy_title` varchar(20) DEFAULT NULL,
  `middle_name` varchar(50) DEFAULT NULL,
  `name_extension` varchar(20) DEFAULT NULL,
  `birthdate` date DEFAULT NULL,
  PRIMARY KEY (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resident_update_requests`
--

LOCK TABLES `resident_update_requests` WRITE;
/*!40000 ALTER TABLE `resident_update_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `resident_update_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `residents`
--

DROP TABLE IF EXISTS `residents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `residents` (
  `resident_id` int(11) NOT NULL AUTO_INCREMENT,
  `resident_number` varchar(20) NOT NULL,
  `courtesy_title` varchar(20) DEFAULT NULL,
  `first_name` varchar(50) NOT NULL,
  `middle_name` varchar(50) DEFAULT NULL,
  `last_name` varchar(50) NOT NULL,
  `name_extension` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `birthdate` date DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `photo_path` varchar(255) DEFAULT NULL,
  `residency_status` varchar(20) NOT NULL DEFAULT 'permanent',
  `residency_start_date` date DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `is_first_login` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `category_reference` varchar(60) DEFAULT NULL,
  `occupation` varchar(100) DEFAULT NULL,
  `hotline_number` varchar(30) DEFAULT NULL,
  `is_married` tinyint(1) NOT NULL DEFAULT 0,
  `spouse_last_name` varchar(50) DEFAULT NULL,
  `spouse_first_name` varchar(50) DEFAULT NULL,
  `spouse_middle_name` varchar(50) DEFAULT NULL,
  `spouse_name_extension` varchar(20) DEFAULT NULL,
  `has_children` tinyint(1) NOT NULL DEFAULT 0,
  `father_last_name` varchar(50) DEFAULT NULL,
  `father_first_name` varchar(50) DEFAULT NULL,
  `father_middle_name` varchar(50) DEFAULT NULL,
  `father_name_extension` varchar(20) DEFAULT NULL,
  `mother_last_name` varchar(50) DEFAULT NULL,
  `mother_first_name` varchar(50) DEFAULT NULL,
  `mother_middle_name` varchar(50) DEFAULT NULL,
  `mother_name_extension` varchar(20) DEFAULT NULL,
  `spouse_courtesy_title` varchar(20) DEFAULT NULL,
  `spouse_gender` varchar(20) DEFAULT NULL,
  `father_courtesy_title` varchar(20) DEFAULT NULL,
  `father_gender` varchar(20) DEFAULT NULL,
  `mother_courtesy_title` varchar(20) DEFAULT NULL,
  `mother_gender` varchar(20) DEFAULT NULL,
  `birthplace` varchar(150) DEFAULT NULL,
  `special_category` varchar(20) NOT NULL DEFAULT 'none',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `household_number` varchar(50) DEFAULT NULL,
  `purok` varchar(100) DEFAULT NULL,
  `street_highway` varchar(150) DEFAULT NULL,
  `barangay` varchar(100) DEFAULT NULL,
  `municipality` varchar(100) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `residence_type` varchar(5) DEFAULT NULL,
  `temporary_address` varchar(255) DEFAULT NULL,
  `temp_household_number` varchar(50) DEFAULT NULL,
  `temp_purok` varchar(100) DEFAULT NULL,
  `temp_street_highway` varchar(150) DEFAULT NULL,
  `temp_barangay` varchar(100) DEFAULT NULL,
  `temp_municipality` varchar(100) DEFAULT NULL,
  `temp_postal_code` varchar(10) DEFAULT NULL,
  `temp_province` varchar(100) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `deleted_by_name` varchar(100) DEFAULT NULL,
  `delete_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`resident_id`),
  UNIQUE KEY `resident_number` (`resident_number`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `residents`
--

LOCK TABLES `residents` WRITE;
/*!40000 ALTER TABLE `residents` DISABLE KEYS */;

/*!40000 ALTER TABLE `residents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `responses`
--

DROP TABLE IF EXISTS `responses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `responses` (
  `response_id` int(11) NOT NULL AUTO_INCREMENT,
  `survey_id` int(11) NOT NULL,
  `resident_id` int(11) NOT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`response_id`),
  UNIQUE KEY `uniq_response_per_resident` (`survey_id`,`resident_id`),
  KEY `survey_id` (`survey_id`),
  KEY `resident_id` (`resident_id`),
  CONSTRAINT `fk_response_resident` FOREIGN KEY (`resident_id`) REFERENCES `residents` (`resident_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_response_survey` FOREIGN KEY (`survey_id`) REFERENCES `surveys` (`survey_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `responses`
--

LOCK TABLES `responses` WRITE;
/*!40000 ALTER TABLE `responses` DISABLE KEYS */;
/*!40000 ALTER TABLE `responses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `staff`
--

DROP TABLE IF EXISTS `staff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff` (
  `staff_id` int(11) NOT NULL AUTO_INCREMENT,
  `staff_number` varchar(20) DEFAULT NULL,
  `username` varchar(50) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `courtesy_title` varchar(20) DEFAULT NULL,
  `first_name` varchar(50) DEFAULT NULL,
  `middle_name` varchar(50) DEFAULT NULL,
  `last_name` varchar(50) DEFAULT NULL,
  `name_extension` varchar(20) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(30) NOT NULL DEFAULT 'staff',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `position` varchar(100) DEFAULT NULL,
  `date_hired` date DEFAULT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `birthdate` date DEFAULT NULL,
  `license_number` varchar(50) DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `emergency_contact` varchar(150) DEFAULT NULL,
  `emergency_contact_name` varchar(100) DEFAULT NULL,
  `emergency_contact_number` varchar(20) DEFAULT NULL,
  `photo_path` varchar(255) DEFAULT NULL,
  `household_number` varchar(50) DEFAULT NULL,
  `purok` varchar(100) DEFAULT NULL,
  `street_highway` varchar(150) DEFAULT NULL,
  `barangay` varchar(100) DEFAULT NULL,
  `municipality` varchar(100) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `is_first_login` tinyint(1) NOT NULL DEFAULT 0,
  `profile_completed` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(11) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `deleted_by_name` varchar(100) DEFAULT NULL,
  `delete_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`staff_id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff`
--

LOCK TABLES `staff` WRITE;
/*!40000 ALTER TABLE `staff` DISABLE KEYS */;

/*!40000 ALTER TABLE `staff` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `staff_update_requests`
--

DROP TABLE IF EXISTS `staff_update_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff_update_requests` (
  `request_id` int(11) NOT NULL AUTO_INCREMENT,
  `staff_id` int(11) NOT NULL,
  `staff_number` varchar(20) DEFAULT NULL,
  `staff_name` varchar(120) DEFAULT NULL,
  `household_number` varchar(50) DEFAULT NULL,
  `purok` varchar(100) DEFAULT NULL,
  `street_highway` varchar(150) DEFAULT NULL,
  `barangay` varchar(100) DEFAULT NULL,
  `municipality` varchar(100) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `previous_address` varchar(255) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_by_name` varchar(100) DEFAULT NULL,
  `review_comment` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff_update_requests`
--

LOCK TABLES `staff_update_requests` WRITE;
/*!40000 ALTER TABLE `staff_update_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `staff_update_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_choices`
--

DROP TABLE IF EXISTS `survey_choices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_choices` (
  `choice_id` int(11) NOT NULL AUTO_INCREMENT,
  `question_id` int(11) NOT NULL,
  `choice_text` varchar(150) NOT NULL,
  PRIMARY KEY (`choice_id`),
  KEY `question_id` (`question_id`),
  CONSTRAINT `fk_choice_question` FOREIGN KEY (`question_id`) REFERENCES `survey_questions` (`question_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_choices`
--

LOCK TABLES `survey_choices` WRITE;
/*!40000 ALTER TABLE `survey_choices` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_choices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_questions`
--

DROP TABLE IF EXISTS `survey_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_questions` (
  `question_id` int(11) NOT NULL AUTO_INCREMENT,
  `survey_id` int(11) NOT NULL,
  `question_text` varchar(255) NOT NULL,
  `question_type` enum('multiple_choice','yesno','rating','short_answer') NOT NULL,
  `question_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`question_id`),
  KEY `survey_id` (`survey_id`),
  CONSTRAINT `fk_question_survey` FOREIGN KEY (`survey_id`) REFERENCES `surveys` (`survey_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_questions`
--

LOCK TABLES `survey_questions` WRITE;
/*!40000 ALTER TABLE `survey_questions` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_results`
--

DROP TABLE IF EXISTS `survey_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_results` (
  `answer_id` int(11) NOT NULL AUTO_INCREMENT,
  `response_id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  `choice_id` int(11) DEFAULT NULL,
  `rating_value` int(11) DEFAULT NULL,
  `answer_text` text DEFAULT NULL,
  PRIMARY KEY (`answer_id`),
  KEY `response_id` (`response_id`),
  KEY `question_id` (`question_id`),
  CONSTRAINT `fk_result_response` FOREIGN KEY (`response_id`) REFERENCES `responses` (`response_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_results`
--

LOCK TABLES `survey_results` WRITE;
/*!40000 ALTER TABLE `survey_results` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `surveys`
--

DROP TABLE IF EXISTS `surveys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `surveys` (
  `survey_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`survey_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `surveys`
--

LOCK TABLES `surveys` WRITE;
/*!40000 ALTER TABLE `surveys` DISABLE KEYS */;
/*!40000 ALTER TABLE `surveys` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-19 22:33:44
