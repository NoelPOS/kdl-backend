-- ============================================
-- Script: Clean up Sessions, Schedules, Receipts, Invoices
-- Description: Deletes data in correct order to avoid FK violations
-- WARNING: This will delete all data from these tables!
-- ============================================

-- STEP 1: Delete receipts first (they reference invoices)
DELETE FROM receipts;

-- STEP 2: Delete invoice items (they reference invoices)
DELETE FROM invoice_items;

-- STEP 3: Delete invoices (they reference sessions)
DELETE FROM invoices;

-- STEP 4: Delete schedules (they reference sessions, students, teachers, courses)
DELETE FROM schedules;

-- STEP 5: Delete sessions (they reference students, courses, teachers, class_options)
DELETE FROM sessions;

-- Verify counts after cleanup
SELECT 'receipts' as table_name, COUNT(*) as count FROM receipts
UNION ALL
SELECT 'invoice_items', COUNT(*) FROM invoice_items
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'schedules', COUNT(*) FROM schedules
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions;

-- ============================================
-- To run this script via psql:
-- PGPASSWORD=Password123 psql -h kiddee-lab-lms.cijeais8s352.us-east-1.rds.amazonaws.com -U postgres -d postgres -f cleanup-sessions.sql
-- ============================================
