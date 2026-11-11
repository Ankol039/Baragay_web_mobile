-- ============================================================
-- Barangay Health Center Survey System
-- Migration: account activation + resident registration fields
--
-- config/db.php adds these automatically on first page load, so
-- running this by hand is optional. Kept here as the explicit
-- record of the schema change.
--
-- Safe to run more than once (MariaDB 10.2+).
-- ============================================================

USE 'barangay_survey_system';   -- commented out: select the database in phpMyAdmin before importing

-- Deactivation flags. A deactivated account still exists and keeps
-- its history, but is refused at login.
ALTER TABLE `staff`
  ADD COLUMN IF NOT EXISTS `is_active` tinyint(1) NOT NULL DEFAULT 1;

ALTER TABLE `residents`
  ADD COLUMN IF NOT EXISTS `is_active`        tinyint(1)   NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `birthdate`        date         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `gender`           varchar(10)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `middle_name`      varchar(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `name_extension`   varchar(20)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `birthplace`       varchar(150) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `special_category` varchar(20)  NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS `residency_status` varchar(20)  NOT NULL DEFAULT 'permanent';

-- Note: age is deliberately NOT a column. It is derived from
-- `birthdate` at display time so it can never drift out of date.
