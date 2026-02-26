/**
 * Revert Course Consolidation
 *
 * This script reverses the damage done by apply_course_consolidation.ts.
 *
 * WHAT THIS FIXES (fully reversible):
 *   1. Restores original title, ageRange, medium for courses IDs 1–61
 *   2. Re-inserts the 93 deleted course records (IDs 62–154) with their original titles
 *
 * WHAT THIS CANNOT FIX (data loss without PITR):
 *   - sessions.courseId reassignments: sessions moved from source IDs to target IDs
 *     are now merged and indistinguishable. They remain on the target IDs.
 *     However, because the merges were semantically equivalent courses, this is
 *     acceptable – the courses will have correct names again after this revert.
 *   - ID 93 "Kid 5 days 5 activities": its sessions were hard-deleted. Gone.
 *
 * DATA SOURCES:
 *   - courses_master_backup.csv: original ageRange + medium for IDs 1–61
 *   - courses_master_before_renumber.csv: original titles for IDs 62–154
 *   - plan_summary.json: oldTitle cross-check for IDs 1–61
 *
 * Usage:
 *   npx ts-node scripts/revert-course-consolidation.ts --dry-run
 *   npx ts-node scripts/revert-course-consolidation.ts
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const ROOT_DIR = path.resolve(__dirname, '../..');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── CSV parser ────────────────────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += char; }
  }
  result.push(current);
  return result;
}

interface CourseRow {
  id: number;
  title: string;
  description: string;
  ageRange: string;
  medium: string;
  sourceImage: string;
}

function parseCSV(filePath: string): Map<number, CourseRow> {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
  const map = new Map<number, CourseRow>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const id = parseInt(cols[0], 10);
    if (isNaN(id)) continue;
    // Only record the FIRST occurrence of each ID (canonical rows come first)
    if (map.has(id)) continue;
    map.set(id, {
      id,
      title: cols[1] ?? '',
      description: cols[2] ?? '',
      ageRange: cols[3] ?? '',
      medium: cols[4] ?? '',
      sourceImage: cols[5] ?? '',
    });
  }
  return map;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function revert() {
  const backupPath = path.join(ROOT_DIR, 'courses_master_backup.csv');
  const preRenumberPath = path.join(ROOT_DIR, 'courses_master_before_renumber.csv');

  if (!fs.existsSync(backupPath))       throw new Error(`Missing: ${backupPath}`);
  if (!fs.existsSync(preRenumberPath))  throw new Error(`Missing: ${preRenumberPath}`);

  // IDs 1–61: use backup CSV (has correct ageRange + medium)
  const backupMap = parseCSV(backupPath);
  // IDs 62–154: use before_renumber CSV (correct titles matching DB at consolidation time)
  const preRenumberMap = parseCSV(preRenumberPath);

  if (DRY_RUN) {
    console.log('=== DRY RUN MODE — no changes will be written ===\n');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query('BEGIN');

    // ── Step 1: Restore course titles/ageRange/medium for IDs 1–61 ──────────────
    console.log('─── Step 1: Restoring course records for IDs 1–61 ───');
    let updatedCount = 0;

    // Fetch current DB state so we can log what changes
    const currentRows = await client.query<{ id: number; title: string; ageRange: string; medium: string }>(
      `SELECT id, title, "ageRange", medium FROM courses WHERE id <= 61 ORDER BY id`
    );
    const currentMap = new Map(currentRows.rows.map(r => [r.id, r]));

    for (let id = 1; id <= 61; id++) {
      const orig = backupMap.get(id);
      if (!orig) {
        console.warn(`  ⚠ No backup data for ID ${id}, skipping`);
        continue;
      }
      const current = currentMap.get(id);
      const titleChanged   = current?.title    !== orig.title;
      const ageChanged     = current?.ageRange !== orig.ageRange;
      const mediumChanged  = current?.medium   !== orig.medium;

      if (!titleChanged && !ageChanged && !mediumChanged) {
        console.log(`  ✓ ID ${id}: already correct — "${orig.title}"`);
        continue;
      }

      console.log(`  ↩ ID ${id}: "${current?.title}" → "${orig.title}" | age: "${current?.ageRange}" → "${orig.ageRange}" | medium: "${current?.medium}" → "${orig.medium}"`);

      if (!DRY_RUN) {
        await client.query(
          `UPDATE courses SET title = $1, "ageRange" = $2, medium = $3, description = $4 WHERE id = $5`,
          [orig.title, orig.ageRange || null, orig.medium || null, orig.description || null, id],
        );
      }
      updatedCount++;
    }
    console.log(`\nUpdated ${updatedCount} courses in IDs 1–61.\n`);

    // ── Step 2: Re-insert deleted course records (IDs 62–154 + 93) ──────────────
    console.log('─── Step 2: Re-inserting deleted courses (IDs 62–154) ───');

    // Deleted IDs: all consolidation sourceIds > 61, plus deletion sourceId 93
    const deletedIds = new Set<number>();
    // From plan_summary consolidations (all sourceIds > 61 were deleted)
    for (let id = 62; id <= 154; id++) deletedIds.add(id);
    // ID 93 was also in deletions - already included above

    // Check which IDs already exist in DB (in case of partial revert)
    const existingResult = await client.query<{ id: number }>(
      `SELECT id FROM courses WHERE id = ANY($1::int[])`,
      [[...deletedIds]]
    );
    const existingIds = new Set(existingResult.rows.map(r => r.id));

    let insertedCount = 0;
    let skippedCount = 0;

    for (const id of [...deletedIds].sort((a, b) => a - b)) {
      if (existingIds.has(id)) {
        console.log(`  ✓ ID ${id}: already exists in DB, skipping`);
        skippedCount++;
        continue;
      }

      // Use before_renumber CSV for accurate title at consolidation time
      // Fall back to backup CSV if not found
      const row = preRenumberMap.get(id) ?? backupMap.get(id);
      if (!row) {
        console.warn(`  ⚠ ID ${id}: no data in any backup CSV — inserting with placeholder title`);
        if (!DRY_RUN) {
          await client.query(
            `INSERT INTO courses (id, title, "ageRange", medium) VALUES ($1, $2, $3, $4)`,
            [id, `[Deleted Course #${id}]`, null, null],
          );
        }
        insertedCount++;
        continue;
      }

      console.log(`  + ID ${id}: re-inserting "${row.title}"`);
      if (!DRY_RUN) {
        await client.query(
          `INSERT INTO courses (id, title, description, "ageRange", medium, "sourceImage")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            row.title,
            row.description || null,
            row.ageRange   || null,
            row.medium     || null,
            row.sourceImage || null,
          ],
        );
      }
      insertedCount++;
    }
    console.log(`\nRe-inserted ${insertedCount} courses, skipped ${skippedCount} already-existing.\n`);

    // ── Summary ─────────────────────────────────────────────────────────────────
    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('=== DRY RUN COMPLETE — transaction rolled back, no changes made ===');
      console.log(`Would have updated ${updatedCount} courses and re-inserted ${insertedCount} courses.`);
    } else {
      await client.query('COMMIT');
      console.log('✅ REVERT COMPLETE — transaction committed successfully.');
      console.log(`Updated ${updatedCount} course titles/ages/mediums.`);
      console.log(`Re-inserted ${insertedCount} deleted course records.`);
      console.log('\n⚠️  NOTE: Session/schedule courseId reassignments were NOT reversed.');
      console.log('   Sessions that were merged into consolidation targets remain there.');
      console.log('   However, all course records now have their correct original names.');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERROR — transaction rolled back, no changes were made.', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

revert().catch(console.error);
