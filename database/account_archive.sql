-- ============================================================
-- Account archive (soft delete) for residents and staff
-- ------------------------------------------------------------
-- config/db.php applies all of this automatically on the first page
-- load. This file is the explicit record if you would rather run it
-- yourself in phpMyAdmin.
--
-- WHY
-- Deleting a resident used to run DELETE FROM residents. The foreign
-- key on `responses` cascaded, so the account and every survey answer
-- it had ever submitted were destroyed together, with no way back.
--
-- Deletion now only stamps `deleted_at`. The row stays, the responses
-- stay attached to it, and an administrator restores it from
-- staff/deleted_accounts.php.
--
-- `deleted_at IS NULL` is the test for "this account is live". Every
-- listing, every count, and the login check in index.php filter on it.
-- ============================================================

USE `barangay_survey_system`;

ALTER TABLE `residents`
  ADD COLUMN IF NOT EXISTS `deleted_at`      datetime     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `deleted_by`      int(11)      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `deleted_by_name` varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `delete_reason`   varchar(255) DEFAULT NULL;

ALTER TABLE `staff`
  ADD COLUMN IF NOT EXISTS `deleted_at`      datetime     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `deleted_by`      int(11)      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `deleted_by_name` varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `delete_reason`   varchar(255) DEFAULT NULL;

-- Every existing account is live: NULL is already the default, so no
-- backfill is needed and no current account is hidden by this change.

-- Listings filter on deleted_at, so give it an index on both tables.
CREATE INDEX IF NOT EXISTS `idx_residents_deleted_at` ON `residents` (`deleted_at`);
CREATE INDEX IF NOT EXISTS `idx_staff_deleted_at`     ON `staff` (`deleted_at`);
