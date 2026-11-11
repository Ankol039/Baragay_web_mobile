-- ============================================================
-- Barangay Health Center Survey System
-- Migration: staff onboarding + resident deletion requests
--
-- config/db.php applies all of this automatically on the first page
-- load, so running this by hand is optional. Kept here as the explicit
-- record of the schema change.
--
-- Safe to run more than once (MariaDB 10.2+).
-- ============================================================

USE 'barangay_survey_system';   -- select the database in phpMyAdmin before importing

-- ------------------------------------------------------------
-- 1. Staff employment record
--
-- The administrator owns these fields. They describe the job, not the
-- person, and a staff member cannot edit them about themselves.
-- ------------------------------------------------------------
ALTER TABLE `staff`
  ADD COLUMN IF NOT EXISTS `staff_number`   varchar(20)  DEFAULT NULL AFTER `staff_id`,
  ADD COLUMN IF NOT EXISTS `first_name`     varchar(50)  DEFAULT NULL AFTER `full_name`,
  ADD COLUMN IF NOT EXISTS `middle_name`    varchar(50)  DEFAULT NULL AFTER `first_name`,
  ADD COLUMN IF NOT EXISTS `last_name`      varchar(50)  DEFAULT NULL AFTER `middle_name`,
  ADD COLUMN IF NOT EXISTS `name_extension` varchar(20)  DEFAULT NULL AFTER `last_name`,
  ADD COLUMN IF NOT EXISTS `date_hired`     date         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `created_by`     int(11)      DEFAULT NULL;

-- ------------------------------------------------------------
-- 2. Personal profile
--
-- The staff member owns these. They are filled in by the new hire at
-- first login, never transcribed by an administrator from a paper form.
-- ------------------------------------------------------------
ALTER TABLE `staff`
  ADD COLUMN IF NOT EXISTS `contact_number`    varchar(20)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `email`             varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `birthdate`         date         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `gender`            varchar(10)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `address`           varchar(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `emergency_contact` varchar(150) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `photo_path`        varchar(255) DEFAULT NULL;

-- Permanent address in parts rather than one free-text line. A staff
-- member's address change has to be reviewable by an administrator, and you
-- cannot review a single string without guessing which part actually moved.
-- The assembled line is still written to `address` so existing displays keep
-- working.
ALTER TABLE `staff`
  ADD COLUMN IF NOT EXISTS `household_number`    varchar(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `purok`               varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `street_highway`      varchar(150) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `barangay`            varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `municipality`        varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `postal_code`         varchar(10)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `province`            varchar(100) DEFAULT NULL;

-- ------------------------------------------------------------
-- 3. Onboarding state
--
-- Both defaults deliberately mean "already onboarded". Adding a column
-- applies its default to every existing row, so a default of
-- is_first_login = 1 would lock the current admin out of their own
-- system on the next page load. New accounts get the pending values
-- (1 and 0) written explicitly by the INSERT in user_management.php.
-- ------------------------------------------------------------
ALTER TABLE `staff`
  ADD COLUMN IF NOT EXISTS `is_first_login`    tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `profile_completed` tinyint(1) NOT NULL DEFAULT 1;

-- ------------------------------------------------------------
-- 4. Backfill Staff Numbers for accounts that predate the column.
--
-- Numbers follow S-YYYY-NNNN, one letter apart from the Resident
-- Number series, and the sequence is global rather than per-year so a
-- number is never handed out twice.
-- ------------------------------------------------------------
SET @seq = (
  SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(`staff_number`, '-', -1) AS UNSIGNED)), 0)
  FROM `staff`
  WHERE `staff_number` LIKE 'S-%'
);

UPDATE `staff`
   SET `staff_number` = CONCAT('S-', YEAR(CURDATE()), '-', LPAD((@seq := @seq + 1), 4, '0'))
 WHERE `staff_number` IS NULL OR `staff_number` = ''
 ORDER BY `staff_id`;

-- ------------------------------------------------------------
-- 5. Resident deletion requests
--
-- Deleting a resident cascades to their survey responses, so the
-- action is reserved for an administrator. Staff raise a request here
-- instead. The snapshot columns mean the audit trail outlives the
-- record it authorised the deletion of.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `resident_delete_requests` (
  `request_id`        int(11)      NOT NULL AUTO_INCREMENT,
  `resident_id`       int(11)      NOT NULL,
  `resident_number`   varchar(20)  DEFAULT NULL,
  `resident_name`     varchar(120) DEFAULT NULL,
  `reason`            varchar(255) NOT NULL,
  `requested_by`      int(11)      DEFAULT NULL,
  `requested_by_name` varchar(100) DEFAULT NULL,
  `status`            varchar(20)  NOT NULL DEFAULT 'pending',
  `requested_at`      timestamp    NOT NULL DEFAULT current_timestamp(),
  `reviewed_at`       datetime     DEFAULT NULL,
  `reviewed_by`       int(11)      DEFAULT NULL,
  `reviewed_by_name`  varchar(100) DEFAULT NULL,
  `review_comment`    varchar(255) DEFAULT NULL,
  PRIMARY KEY (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Note: resident_id is deliberately NOT a foreign key. Approving a
-- request deletes the resident, and the request row has to survive
-- that so the decision stays on the record.

-- ------------------------------------------------------------
-- 6. Staff address change requests
--
-- A staff member's permanent address is on file for employment records, so
-- a change is reviewed rather than self-served. The first entry made during
-- onboarding writes straight through; every later change lands here and
-- waits for an administrator. previous_address is snapshotted so the
-- reviewer can see both sides of the change without a join.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `staff_update_requests` (
  `request_id`          int(11)      NOT NULL AUTO_INCREMENT,
  `staff_id`            int(11)      NOT NULL,
  `staff_number`        varchar(20)  DEFAULT NULL,
  `staff_name`          varchar(120) DEFAULT NULL,
  `household_number`    varchar(50)  DEFAULT NULL,
  `purok`               varchar(100) DEFAULT NULL,
  `street_highway`      varchar(150) DEFAULT NULL,
  `barangay`            varchar(100) DEFAULT NULL,
  `municipality`        varchar(100) DEFAULT NULL,
  `postal_code`         varchar(10)  DEFAULT NULL,
  `province`            varchar(100) DEFAULT NULL,
  `address`             varchar(255) DEFAULT NULL,
  `previous_address`    varchar(255) DEFAULT NULL,
  `reason`              varchar(255) DEFAULT NULL,
  `status`              varchar(20)  NOT NULL DEFAULT 'pending',
  `submitted_at`        timestamp    NOT NULL DEFAULT current_timestamp(),
  `reviewed_at`         datetime     DEFAULT NULL,
  `reviewed_by`         int(11)      DEFAULT NULL,
  `reviewed_by_name`    varchar(100) DEFAULT NULL,
  `review_comment`      varchar(255) DEFAULT NULL,
  PRIMARY KEY (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------
-- 7. Courtesy titles, resident address parts, temporary residence
--
-- The resident address previously lived only as a comma-joined string that
-- every form split back apart by position. Any address with a different
-- comma count landed in the wrong boxes, and the resident's "request a
-- change" screen compared reassembled strings, so it reported no change
-- when there was one. The parts are now the source of truth.
-- ------------------------------------------------------------
ALTER TABLE `staff`
  ADD COLUMN IF NOT EXISTS `courtesy_title` varchar(20) DEFAULT NULL AFTER `full_name`;

ALTER TABLE `residents`
  ADD COLUMN IF NOT EXISTS `courtesy_title`   varchar(20)  DEFAULT NULL AFTER `resident_number`,
  ADD COLUMN IF NOT EXISTS `household_number` varchar(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `purok`            varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `street_highway`   varchar(150) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `barangay`         varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `municipality`     varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `postal_code`      varchar(10)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `province`         varchar(100) DEFAULT NULL;

-- Temporary residence. Only meaningful when residency_status is 'temporary':
-- a resident in a boarding house still has a permanent address elsewhere.
ALTER TABLE `residents`
  ADD COLUMN IF NOT EXISTS `residence_type`        varchar(5)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `temporary_address`     varchar(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `temp_household_number` varchar(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `temp_purok`            varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `temp_street_highway`   varchar(150) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `temp_barangay`         varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `temp_municipality`     varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `temp_postal_code`      varchar(10)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `temp_province`         varchar(100) DEFAULT NULL;

-- The resident change-request table. Created here because a manual import
-- has no PHP to lean on: config/db.php creates it on first page load, so
-- the ALTER further down used to fail with "table doesn't exist" for anyone
-- importing these files into an empty database by hand.
CREATE TABLE IF NOT EXISTS `resident_update_requests` (
  `request_id`           int(11)      NOT NULL AUTO_INCREMENT,
  `resident_id`          int(11)      NOT NULL,
  `first_name`           varchar(50)  DEFAULT NULL,
  `last_name`            varchar(50)  DEFAULT NULL,
  `email`                varchar(100) DEFAULT NULL,
  `contact_number`       varchar(20)  DEFAULT NULL,
  `address`              varchar(255) DEFAULT NULL,
  `household_number`     varchar(50)  DEFAULT NULL,
  `barangay_subdivision` varchar(100) DEFAULT NULL,
  `municipality`         varchar(100) DEFAULT NULL,
  `province`             varchar(100) DEFAULT NULL,
  `status`               varchar(20)  NOT NULL DEFAULT 'pending',
  `submitted_at`         timestamp    NOT NULL DEFAULT current_timestamp(),
  `reviewed_at`          datetime     DEFAULT NULL,
  `reviewed_by`          int(11)      DEFAULT NULL,
  `review_comment`       varchar(255) DEFAULT NULL,
  PRIMARY KEY (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `resident_update_requests`
  ADD COLUMN IF NOT EXISTS `purok`            varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `street_highway`   varchar(150) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `barangay`         varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `postal_code`      varchar(10)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `previous_address` varchar(255) DEFAULT NULL;

-- ------------------------------------------------------------
-- 8. Gender options
--
-- Widen the columns FIRST. residents.gender was an ENUM('male','female')
-- and staff.gender a varchar(10); an ENUM silently truncates anything
-- outside its list and 'prefer_not_to_say' is 17 characters, so the
-- UPDATEs below would be discarded without the MODIFYs.
-- ------------------------------------------------------------
ALTER TABLE `residents` MODIFY COLUMN `gender` varchar(20) DEFAULT NULL;
ALTER TABLE `staff`     MODIFY COLUMN `gender` varchar(20) DEFAULT NULL;

UPDATE `residents` SET `gender` = 'man'   WHERE `gender` = 'male';
UPDATE `residents` SET `gender` = 'woman' WHERE `gender` = 'female';
UPDATE `staff`     SET `gender` = 'man'   WHERE `gender` = 'male';
UPDATE `staff`     SET `gender` = 'woman' WHERE `gender` = 'female';

-- ------------------------------------------------------------
-- 9. Emergency contact split, and reviewable resident identity fields
--
-- One free-text emergency contact line could not be dialled or searched
-- reliably, so it is now a name and a number. The old column is kept and
-- written in step so anything still reading it does not go blank.
--
-- A resident's courtesy title, name parts, and birthdate are reviewed
-- rather than self-served, so the request row has to carry each of them.
-- ------------------------------------------------------------
ALTER TABLE `staff`
  ADD COLUMN IF NOT EXISTS `emergency_contact_name`   varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `emergency_contact_number` varchar(20)  DEFAULT NULL;

UPDATE `staff`
   SET `emergency_contact_name` = `emergency_contact`
 WHERE (`emergency_contact_name` IS NULL OR `emergency_contact_name` = '')
   AND `emergency_contact` IS NOT NULL AND `emergency_contact` <> '';

ALTER TABLE `resident_update_requests`
  ADD COLUMN IF NOT EXISTS `courtesy_title` varchar(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `middle_name`    varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `name_extension` varchar(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `birthdate`      date        DEFAULT NULL;
