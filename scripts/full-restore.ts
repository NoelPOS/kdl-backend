/**
 * Full Restore — 100% reversal of apply_course_consolidation.ts
 *
 * This script achieves a COMPLETE revert using the root CSV files as the
 * pre-consolidation source of truth for session assignments.
 *
 * HOW IT WORKS:
 *   The root workspace contains sessions_2025.csv (IDs 1-220) and
 *   sessions_2024.csv (IDs 221-349) which were created BEFORE
 *   apply_course_consolidation.ts ran. They contain the original courseId for
 *   every session that was in the DB at consolidation time.
 *
 *   apply_course_consolidation.ts ONLY modified the Neon database — it never
 *   touched these CSV files. So they are a perfect snapshot of the
 *   pre-consolidation state.
 *
 * WHAT THIS SCRIPT DOES (in a single transaction):
 *   Step 1 — Re-insert deleted course rows (IDs 62–154) using
 *             courses_master_before_renumber.csv as source.
 *             Must come first so FK constraints on sessions are satisfied.
 *
 *   Step 2 — Restore title/ageRange/medium for IDs 1–61 using
 *             courses_master_backup.csv as source.
 *
 *   Step 3 — Restore sessions.courseId for all session IDs found in the CSV
 *             files, back to their original pre-consolidation values.
 *             Only sessions whose courseId actually changed are updated.
 *
 * WHAT STAYS UNTOUCHED:
 *   - All other session fields (payment, status, classOptionId, teacherId, etc.)
 *   - Sessions with IDs not present in the CSV files (created after seeding)
 *     — these are out of scope and must be reviewed manually if needed.
 *   - schedules table (not touched by original script either for the
 *     operations that matter; teacher_courses references are handled via courses).
 *
 * Usage:
 *   npx ts-node scripts/full-restore.ts --dry-run   ← safe preview
 *   npx ts-node scripts/full-restore.ts             ← apply for real
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const ROOT_DIR = path.resolve(__dirname, '../..');
const DRY_RUN = process.argv.includes('--dry-run');

// ── CSV helpers ────────────────────────────────────────────────────────────────

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

function parseCourseCSV(filePath: string): Map<number, CourseRow> {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
  const map = new Map<number, CourseRow>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const id = parseInt(cols[0], 10);
    if (isNaN(id)) continue;
    if (map.has(id)) continue; // first occurrence is canonical
    map.set(id, {
      id,
      title:       (cols[1] ?? '').trim(),
      description: (cols[2] ?? '').trim(),
      ageRange:    (cols[3] ?? '').trim(),
      medium:      (cols[4] ?? '').trim(),
      sourceImage: (cols[5] ?? '').trim(),
    });
  }
  return map;
}

/** Returns map of sessionId → courseId from a sessions CSV file */
function parseSessionCSV(filePath: string): Map<number, number> {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
  if (lines.length < 2) return new Map();

  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const sidIdx  = headers.indexOf('sessionId');
  const cidIdx  = headers.indexOf('courseId');

  if (sidIdx === -1 || cidIdx === -1) {
    throw new Error(`${filePath}: missing sessionId or courseId column (got: ${headers.join(', ')})`);
  }

  const map = new Map<number, number>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const sid  = parseInt(cols[sidIdx], 10);
    const cid  = parseInt(cols[cidIdx], 10);
    if (!isNaN(sid) && !isNaN(cid)) {
      map.set(sid, cid);
    }
  }
  return map;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function fullRestore() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║            Full Restore — 100% reversal of consolidation       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  if (DRY_RUN) {
    console.log('\n🔍  DRY RUN MODE — no changes will be written to the database\n');
  } else {
    console.log('\n⚠️   LIVE MODE — changes WILL be committed to the database\n');
  }

  // ── Paths ──────────────────────────────────────────────────────────────────
  const backupPath      = path.join(ROOT_DIR, 'courses_master_backup.csv');
  const preRenumberPath = path.join(ROOT_DIR, 'courses_master_before_renumber.csv');
  const sessions25Path  = path.join(ROOT_DIR, 'sessions_2025.csv');
  const sessions24Path  = path.join(ROOT_DIR, 'sessions_2024.csv');

  for (const p of [backupPath, preRenumberPath, sessions25Path, sessions24Path]) {
    if (!fs.existsSync(p)) throw new Error(`Required file not found: ${p}`);
  }

  // ── Load data sources ──────────────────────────────────────────────────────
  console.log('📂  Loading data sources...');
  const backupMap      = parseCourseCSV(backupPath);
  const preRenumberMap = parseCourseCSV(preRenumberPath);

  // Merge both session CSVs into one map (sessions_2025 = IDs 1-220, sessions_2024 = IDs 221-349)
  const sessionMap25 = parseSessionCSV(sessions25Path);
  const sessionMap24 = parseSessionCSV(sessions24Path);
  const originalSessionCourse = new Map<number, number>([...sessionMap25, ...sessionMap24]);

  console.log(`   courses_master_backup.csv     : ${backupMap.size} course records`);
  console.log(`   courses_master_before_renumber: ${preRenumberMap.size} course records`);
  console.log(`   sessions_2025.csv             : ${sessionMap25.size} session records`);
  console.log(`   sessions_2024.csv             : ${sessionMap24.size} session records`);
  console.log(`   Combined session coverage     : ${originalSessionCourse.size} sessions\n`);

  // ── Connect ────────────────────────────────────────────────────────────────
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('🔌  Connected to database\n');

  try {
    await client.query('BEGIN');

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 1 — Re-insert deleted course records (IDs 62–154)
    // Must happen BEFORE session courseId restoration so FK constraints hold.
    // ══════════════════════════════════════════════════════════════════════════
    console.log('───────────────────────────────────────────────────────────────');
    console.log('STEP 1  Re-insert deleted courses (IDs 62–154)');
    console.log('───────────────────────────────────────────────────────────────');

    const allDeletedIds: number[] = [];
    for (let id = 62; id <= 154; id++) allDeletedIds.push(id);

    const existingResult = await client.query<{ id: number }>(
      `SELECT id FROM courses WHERE id = ANY($1::int[])`,
      [allDeletedIds],
    );
    const existingIds = new Set(existingResult.rows.map(r => r.id));

    let step1Inserted = 0;
    let step1Skipped  = 0;

    for (const id of allDeletedIds) {
      if (existingIds.has(id)) {
        step1Skipped++;
        continue;
      }

      const row = preRenumberMap.get(id) ?? backupMap.get(id);
      if (!row) {
        console.warn(`  ⚠  ID ${id}: no data found in any backup CSV — using placeholder`);
        if (!DRY_RUN) {
          await client.query(
            `INSERT INTO courses (id, title) VALUES ($1, $2)`,
            [id, `[Deleted Course #${id}]`],
          );
        }
        step1Inserted++;
        continue;
      }

      console.log(`  +  ID ${id}: "${row.title}"`);
      if (!DRY_RUN) {
        await client.query(
          `INSERT INTO courses (id, title, description, "ageRange", medium, "sourceImage")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, row.title, row.description || null, row.ageRange || null,
           row.medium || null, row.sourceImage || null],
        );
      }
      step1Inserted++;
    }

    console.log(`\n  → Would insert ${step1Inserted} courses, ${step1Skipped} already exist.\n`);

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 2 — Restore title/ageRange/medium for IDs 1–61
    // ══════════════════════════════════════════════════════════════════════════
    console.log('───────────────────────────────────────────────────────────────');
    console.log('STEP 2  Restore course metadata for IDs 1–61');
    console.log('───────────────────────────────────────────────────────────────');

    const currentCoursesResult = await client.query<{
      id: number; title: string; ageRange: string; medium: string;
    }>(`SELECT id, title, "ageRange", medium FROM courses WHERE id <= 61 ORDER BY id`);
    const currentCourseMap = new Map(currentCoursesResult.rows.map(r => [r.id, r]));

    let step2Updated = 0;
    let step2Already = 0;

    for (let id = 1; id <= 61; id++) {
      const orig    = backupMap.get(id);
      const current = currentCourseMap.get(id);

      if (!orig) {
        console.warn(`  ⚠  ID ${id}: no data in backup CSV, skipping`);
        continue;
      }
      if (!current) {
        console.warn(`  ⚠  ID ${id}: not found in DB, skipping`);
        continue;
      }

      if (current.title === orig.title &&
          (current.ageRange ?? '') === (orig.ageRange ?? '') &&
          (current.medium ?? '')   === (orig.medium ?? '')) {
        step2Already++;
        continue;
      }

      console.log(`  ↩  ID ${id}: "${current.title}" → "${orig.title}"`);
      if (!DRY_RUN) {
        await client.query(
          `UPDATE courses SET title = $1, "ageRange" = $2, medium = $3, description = $4 WHERE id = $5`,
          [orig.title, orig.ageRange || null, orig.medium || null, orig.description || null, id],
        );
      }
      step2Updated++;
    }

    console.log(`\n  → Would update ${step2Updated} courses (${step2Already} already correct).\n`);

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 3 — Restore sessions.courseId from pre-consolidation CSV values
    // ══════════════════════════════════════════════════════════════════════════
    console.log('───────────────────────────────────────────────────────────────');
    console.log('STEP 3  Restore session courseId values');
    console.log('───────────────────────────────────────────────────────────────');

    // Fetch every session currently in the DB
    const dbSessionsResult = await client.query<{ id: number; courseId: number }>(
      `SELECT id, "courseId" FROM sessions ORDER BY id`,
    );

    let step3Updated   = 0;
    let step3Already   = 0;
    let step3NoMapping = 0;

    const updates: Array<{ id: number; oldCid: number; newCid: number }> = [];

    for (const row of dbSessionsResult.rows) {
      const originalCid = originalSessionCourse.get(row.id);

      if (originalCid === undefined) {
        // Session was created after the CSV seeding — skip, out of scope
        step3NoMapping++;
        continue;
      }

      if (row.courseId === originalCid) {
        step3Already++;
        continue;
      }

      updates.push({ id: row.id, oldCid: row.courseId, newCid: originalCid });
    }

    // Print changes grouped by what they were remapped to
    const byMapping = new Map<string, number[]>();
    for (const u of updates) {
      const key = `${u.oldCid} → ${u.newCid}`;
      if (!byMapping.has(key)) byMapping.set(key, []);
      byMapping.get(key)!.push(u.id);
    }

    for (const [mapping, sessionIds] of [...byMapping].sort()) {
      const sample = sessionIds.slice(0, 5).join(', ');
      const more   = sessionIds.length > 5 ? ` … +${sessionIds.length - 5} more` : '';
      console.log(`  courseId ${mapping}  (${sessionIds.length} sessions: ${sample}${more})`);
    }

    if (!DRY_RUN) {
      for (const u of updates) {
        await client.query(
          `UPDATE sessions SET "courseId" = $1 WHERE id = $2`,
          [u.newCid, u.id],
        );
        step3Updated++;
      }
    } else {
      step3Updated = updates.length;
    }

    console.log(`\n  → Would update  : ${step3Updated} sessions`);
    console.log(`    Already correct: ${step3Already} sessions`);
    console.log(`    Out of scope   : ${step3NoMapping} sessions (created after CSV seeding)\n`);

    // ── Commit or rollback ─────────────────────────────────────────────────
    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('════════════════════════════════════════════════════════════════');
      console.log('DRY RUN COMPLETE — transaction rolled back, nothing was changed.');
      console.log('════════════════════════════════════════════════════════════════');
      console.log('\nSummary of what WOULD happen:');
      console.log(`  Step 1: Re-insert ${step1Inserted} deleted course records (IDs 62–154)`);
      console.log(`  Step 2: Update ${step2Updated} course titles/metadata (IDs 1–61)`);
      console.log(`  Step 3: Restore courseId on ${step3Updated} sessions`);
      console.log('\nTo apply: npx ts-node scripts/full-restore.ts');
    } else {
      await client.query('COMMIT');
      console.log('════════════════════════════════════════════════════════════════');
      console.log('✅  FULL RESTORE COMPLETE — transaction committed successfully.');
      console.log('════════════════════════════════════════════════════════════════');
      console.log('\nSummary:');
      console.log(`  Step 1: Re-inserted ${step1Inserted} deleted course records`);
      console.log(`  Step 2: Updated ${step2Updated} course titles/metadata`);
      console.log(`  Step 3: Restored courseId on ${step3Updated} sessions`);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  ERROR — transaction rolled back, no changes were made.');
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fullRestore().catch(console.error);
