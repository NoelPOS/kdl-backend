/**
 * db-fix.ts — Fix-forward database restore
 *
 * Fixes the damage from apply_course_consolidation.ts without a snapshot.
 *
 * ═══════════════════════════════════════════════════════════════════
 * DATA SOURCES
 * ═══════════════════════════════════════════════════════════════════
 *  sessions_2025.csv      Pre-consolidation session IDs 1-220 (all years)
 *  sessions_2024.csv      Pre-consolidation session IDs 221-349 (2024-2025)
 *  courses_master_backup  Correct titles/ageRange/medium for IDs 1-61
 *  ocr-output-gemini/<year>/sessions.csv  OCR sessions (out of scope here,
 *                         these still need consolidate-courses.ts before import)
 *
 * ═══════════════════════════════════════════════════════════════════
 * WHAT THIS SCRIPT DOES (single transaction)
 * ═══════════════════════════════════════════════════════════════════
 *  STEP 1  Restore sessions.courseId for all 349 DB sessions back to the
 *          values they had before apply_course_consolidation ran, sourced
 *          from the root CSV files which were never touched by that script.
 *
 *  STEP 2  For sessions that originally referenced IDs 62-103 (old alias
 *          courses now deleted), force-remap to the correct canonical ID
 *          within 1-61 using the SEMANTIC_MAP below.
 *
 *  STEP 3  Restore title / ageRange / medium for courses 1-61 using
 *          courses_master_backup.csv (the correct state before apply ran).
 *
 * ═══════════════════════════════════════════════════════════════════
 * WHAT THIS DOES NOT DO
 * ═══════════════════════════════════════════════════════════════════
 *  - Does NOT touch ocr-output-gemini sessions (separate import step)
 *  - Does NOT re-insert deleted course rows 62-154 (intentionally kept deleted)
 *  - Sessions for session IDs not in root CSVs (created after seeding) are
 *    left untouched and logged as "out of scope"
 *
 * Usage:
 *   npx ts-node scripts/db-fix.ts --dry-run   ← safe preview, no DB changes
 *   npx ts-node scripts/db-fix.ts             ← apply for real
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const ROOT_DIR = path.resolve(__dirname, '../..');
const DRY_RUN = process.argv.includes('--dry-run');

// ═══════════════════════════════════════════════════════════════════
// SEMANTIC MAP: old alias course ID → canonical ID 1-61
//
// Keys:   course IDs 62-103 that appear in sessions_2025/2024.csv
// Values: target canonical ID in the backup's 1-61 scheme
//
// Legend for target IDs (from courses_master_backup.csv):
//   7-8 iPad:       10=K Beginner  11=K Int I      12=K Int II
//   9-12 Computer:  17=C Beginner  18=C Int I,II   19=C Advanced
//                   20=VEX Starter 21=VEX Comp      22=Animation+Game
//                   23=Halo Beg    26=3D Tinkercad  27=3D Tink Project
//                   28=Minecraft   29=App Design    30=Roblox Beg
//                   31=Roblox Int  32=Everyday Electronics
//   5-6 iPad:        1=Tinkamo Beg  2=Tinkamo Int I  3=Tinkamo Int II
//                    4=Botzees Beg  5=Botzees Int     8=Codey Rocky
//   13+ Pure Coding: 35=Pure Python I  37=Game Dev Python I  39=Pure Python II
//   13+ Hardware:    41=3D Shapr3D  44=Arduino       46=Challenge App Project
//                    47=IoT         48=Robot Arm
//   Special:         49=Free Trial  53=TBC
//   Already in 1-61: 54=Robomaster  55=Halocode Int  56=Halocode Beg
//                    57=VEX Comp Training  58=Botzees Beg  59=Botzees Int
//                    60=K-mBot Beg  61=C-mBot Beg
// ═══════════════════════════════════════════════════════════════════
const SEMANTIC_MAP: Record<number, number> = {
  // ── C-mBot / 9-12 Computer mBot ────────────────────────────────
  62: 18,   // C-mBot Intermediate I      → Fun Coding with mBot Intermediate I,II (9-12 Computer)
  73: 18,   // C-mBot Intermediate II     → Fun Coding with mBot Intermediate I,II (9-12 Computer)

  // ── K-mBot / 7-8 iPad mBot ─────────────────────────────────────
  64: 11,   // K-mBot Intermediate I      → Fun Coding with mBot Intermediate I (7-8 iPad)
  80: 12,   // K-mBot Intermediate II     → Fun Coding with mBot Intermediate II (7-8 iPad)
  81: 11,   // K-Intermediate (alias)     → Fun Coding with mBot Intermediate I (7-8 iPad)

  // ── Python / coding ────────────────────────────────────────────
  63: 37,   // Pygame                     → Game Development with Python I
  77: 35,   // Python Beginner            → Pure Python I
  96: 35,   // Python (alias)             → Pure Python I

  // ── VEX ────────────────────────────────────────────────────────
  78: 20,   // VEX Beginner               → VEX Robotics Starter (VEX IQ)
  87: 20,   // VEX (short alias)          → VEX Robotics Starter (VEX IQ)
  82: 21,   // VEX continue               → VEX IQ Roboticcs Competition I,II
  102: 21,  // Vex Earthquake Project     → VEX IQ Roboticcs Competition I,II (competition prep)

  // ── 3D courses ─────────────────────────────────────────────────
  68: 14,   // 3D Design and Printing     → Creativity with 3D Modeling (Tinkercad) 7-8 iPad
  83: 26,   // 3D TInkercad               → Creativity with 3D Modeling (Tinkercad) 9-12 Computer
  74: 26,   // 3D (short)                 → Creativity with 3D Modeling (Tinkercad) 9-12 Computer
  86: 26,   // 3D Design                  → Creativity with 3D Modeling (Tinkercad) 9-12 Computer
  85: 26,   // 3D Halloween               → Creativity with 3D Modeling (Tinkercad) 9-12 Computer
  99: 26,   // 3D Course                  → Creativity with 3D Modeling (Tinkercad) 9-12 Computer
  70: 27,   // 3D (Tinkercad) Project     → Creativity with 3D Modeling Project 9-12 Computer
  91: 27,   // 3D Tinkercad Project       → Creativity with 3D Modeling Project 9-12 Computer
  97: 27,   // 3D Project                 → Creativity with 3D Modeling Project 9-12 Computer
  100: 41,  // 3D Shapr3D                 → Creativity with 3D Modeling (Shapr3D) 13+ Hardware

  // ── Roblox ─────────────────────────────────────────────────────
  69: 30,   // Roblock (alias Roblox)     → Game Design Roblox Studio Beginner
  71: 30,   // Roblox Beginner            → Game Design Roblox Studio Beginner
  72: 31,   // Roblox Game Design         → Game Design Roblox Studio Intermediate

  // ── MIT App / Application Design ───────────────────────────────
  79: 29,   // Mit App(1000)              → Application Design (MIT App Inventor) 9-12 Computer

  // ── IoT / Hardware ─────────────────────────────────────────────
  65: 47,   // IOT                        → Welcome to World of IoT (ESP32)
  66: 48,   // Robot Arm                  → Getting to know a Robot Arm
  101: 44,  // Arduino I + II             → Exploring Arduino with Python I

  // ── Halocode ───────────────────────────────────────────────────
  88: 56,   // Halocode (alias)           → Halocode Beginner (ID 56, already canonical)

  // ── Tinkamo ────────────────────────────────────────────────────
  84: 2,    // Tinkamo Intermediate       → TInkamo Tinkerer Intermediate I (5-6 iPad)

  // ── Codey Rocky ────────────────────────────────────────────────
  76: 8,    // Codey Rocky Beginner       → Codey Rocky Champion (ID 8, 7-8 iPad)

  // ── IGCSE ──────────────────────────────────────────────────────
  90: 46,   // IGCSE Computer Science     → Challenge with Application Project (advanced/no IGCSE slot in 1-61)
  95: 46,   // IGCSE (short alias)        → Challenge with Application Project

  // ── Special / Projects ─────────────────────────────────────────
  67: 46,   // Funjai                     → Challenge with Application Project
  89: 46,   // Funjai Project             → Challenge with Application Project
  92: 46,   // Project: Cascade PID...    → Challenge with Application Project
  93: 46,   // Digital Literacy           → Challenge with Application Project
  94: 46,   // Project                    → Challenge with Application Project
  98: 49,   // Kid 5 days 5 activities    → Free Trial (no longer used)
  103: 34,  // UX/UI                      → Web Design Development (closest 13+ design)
  75: 46,   // A Level                    → Challenge with Application Project (no A Level slot in 1-61)
};

// ── CSV helpers ───────────────────────────────────────────────────────────────

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

interface CourseBackup {
  id: number;
  title: string;
  description: string;
  ageRange: string;
  medium: string;
}

function parseBackupCSV(filePath: string): Map<number, CourseBackup> {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
  const map = new Map<number, CourseBackup>();
  for (let i = 1; i < lines.length; i++) {
    const c = parseCSVLine(lines[i]);
    const id = parseInt(c[0], 10);
    if (isNaN(id) || map.has(id)) continue;
    map.set(id, { id, title: c[1]?.trim() ?? '', description: c[2]?.trim() ?? '', ageRange: c[3]?.trim() ?? '', medium: c[4]?.trim() ?? '' });
  }
  return map;
}

function parseSessionCSV(filePath: string): Map<number, number> {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
  if (lines.length < 2) return new Map();
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const sidIdx  = headers.indexOf('sessionId');
  const cidIdx  = headers.indexOf('courseId');
  if (sidIdx === -1 || cidIdx === -1) throw new Error(`Missing sessionId/courseId in ${filePath}`);
  const map = new Map<number, number>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const sid  = parseInt(cols[sidIdx], 10);
    const cid  = parseInt(cols[cidIdx], 10);
    if (!isNaN(sid) && !isNaN(cid)) map.set(sid, cid);
  }
  return map;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║               db-fix.ts  —  Fix-Forward Restore               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  if (DRY_RUN) {
    console.log('\n🔍  DRY RUN — no changes will be written\n');
  } else {
    console.log('\n⚠️   LIVE MODE — changes WILL be committed\n');
  }

  // ── Load CSVs ─────────────────────────────────────────────────────────────
  const backupPath  = path.join(ROOT_DIR, 'courses_master_backup.csv');
  const s25Path     = path.join(ROOT_DIR, 'sessions_2025.csv');
  const s24Path     = path.join(ROOT_DIR, 'sessions_2024.csv');
  for (const p of [backupPath, s25Path, s24Path]) {
    if (!fs.existsSync(p)) throw new Error(`Required file not found: ${p}`);
  }

  const backupMap  = parseBackupCSV(backupPath);
  const sessMap25  = parseSessionCSV(s25Path);
  const sessMap24  = parseSessionCSV(s24Path);
  const csvSourceMap = new Map<number, number>([...sessMap25, ...sessMap24]);

  console.log(`📂  Loaded ${backupMap.size} course records from backup`);
  console.log(`📂  Loaded ${csvSourceMap.size} session→courseId entries from root CSVs\n`);

  // ── Connect ───────────────────────────────────────────────────────────────
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('🔌  Connected to database\n');

  try {
    await client.query('BEGIN');

    // ════════════════════════════════════════════════════════════════
    // STEP 1 + 2 — Restore session courseIds, then remap 62-103 → 1-61
    // ════════════════════════════════════════════════════════════════
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('STEP 1/2  Restore session courseIds & remap alias IDs 62-103 → 1-61');
    console.log('─────────────────────────────────────────────────────────────────');

    const dbSessions = await client.query<{ id: number; courseId: number }>(
      `SELECT id, "courseId" FROM sessions ORDER BY id`,
    );

    // Get course title lookup for pretty logging
    const dbCourses = await client.query<{ id: number; title: string }>(
      `SELECT id, title FROM courses`,
    );
    const courseTitle = new Map(dbCourses.rows.map(r => [r.id, r.title]));

    // Augment with backup names for IDs not yet in DB
    for (const [id, row] of backupMap) {
      if (!courseTitle.has(id)) courseTitle.set(id, row.title);
    }

    let restored  = 0;
    let remapped  = 0;
    let unchanged = 0;
    let outOfScope = 0;

    interface Update { sessionId: number; newCid: number; note: string }
    const updates: Update[] = [];

    for (const row of dbSessions.rows) {
      const csvCid = csvSourceMap.get(row.id);

      if (csvCid === undefined) {
        outOfScope++;
        continue;
      }

      // Apply semantic remap if the CSV source ID is 62-103
      const finalCid = SEMANTIC_MAP[csvCid] ?? csvCid;

      if (finalCid === row.courseId) {
        unchanged++;
        continue;
      }

      const note = SEMANTIC_MAP[csvCid]
        ? `restore+remap: DB[${row.courseId}] ← CSV[${csvCid}] → final[${finalCid}] (${courseTitle.get(finalCid) ?? '?'})`
        : `restore: DB[${row.courseId}] → CSV[${csvCid}] (${courseTitle.get(csvCid) ?? '?'})`;

      updates.push({ sessionId: row.id, newCid: finalCid, note });

      if (csvCid === finalCid) restored++;
      else remapped++;
    }

    // Print grouped summary
    const byMapping = new Map<string, number[]>();
    for (const u of updates) {
      if (!byMapping.has(u.note)) byMapping.set(u.note, []);
      byMapping.get(u.note)!.push(u.sessionId);
    }

    // Group by courseId change for readability instead
    const byChange = new Map<string, { sessionIds: number[]; note: string }>();
    for (const u of updates) {
      const key = u.newCid.toString();
      if (!byChange.has(key)) byChange.set(key, { sessionIds: [], note: `→ courseId ${u.newCid} (${courseTitle.get(u.newCid) ?? '?'})` });
      byChange.get(key)!.sessionIds.push(u.sessionId);
    }

    for (const [, { sessionIds, note }] of [...byChange].sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
      const sample = sessionIds.slice(0, 6).join(', ');
      const more   = sessionIds.length > 6 ? ` +${sessionIds.length - 6} more` : '';
      console.log(`  ${note}  [${sessionIds.length} sessions: ${sample}${more}]`);
    }

    if (!DRY_RUN) {
      for (const u of updates) {
        await client.query(`UPDATE sessions SET "courseId" = $1 WHERE id = $2`, [u.newCid, u.sessionId]);
      }
    }

    console.log(`\n  → Total changes : ${updates.length} sessions`);
    console.log(`    Restored only : ${restored}`);
    console.log(`    Remapped 62-103: ${remapped}`);
    console.log(`    Already correct: ${unchanged}`);
    console.log(`    Out of scope   : ${outOfScope} (created after CSV seeding)\n`);

    // Warn about any session IDs in root CSVs that referenced IDs not in SEMANTIC_MAP and > 61
    const unmappedHighIds = new Set<number>();
    for (const [, cid] of csvSourceMap) {
      if (cid > 61 && SEMANTIC_MAP[cid] === undefined) {
        unmappedHighIds.add(cid);
      }
    }
    if (unmappedHighIds.size > 0) {
      console.log(`  ⚠  IDs > 61 with no semantic mapping (kept as-is, may cause FK issues):`);
      for (const id of [...unmappedHighIds].sort((a,b)=>a-b)) {
        console.log(`     ${id}: ${backupMap.get(id)?.title ?? '?'}`);
      }
      console.log('');
    }

    // ════════════════════════════════════════════════════════════════
    // STEP 3 — Restore course metadata for IDs 1-61
    // ════════════════════════════════════════════════════════════════
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('STEP 3  Restore course title / ageRange / medium for IDs 1-61');
    console.log('─────────────────────────────────────────────────────────────────');

    const dbCoursesResult = await client.query<{ id: number; title: string; ageRange: string; medium: string }>(
      `SELECT id, title, "ageRange", medium FROM courses WHERE id <= 61 ORDER BY id`,
    );
    const dbCourseMap = new Map<number, { id: number; title: string; ageRange: string; medium: string }>(
      dbCoursesResult.rows.map(r => [r.id, r]),
    );

    let step3Updated = 0;
    let step3Already = 0;

    for (let id = 1; id <= 61; id++) {
      const backup  = backupMap.get(id);
      const current = dbCourseMap.get(id);
      if (!backup) { console.warn(`  ⚠  ID ${id}: not in backup CSV, skipping`); continue; }
      if (!current) { console.warn(`  ⚠  ID ${id}: not found in DB, skipping`); continue; }

      const titleOk   = current.title    === backup.title;
      const ageOk     = (current.ageRange ?? '') === (backup.ageRange ?? '');
      const mediumOk  = (current.medium  ?? '') === (backup.medium   ?? '');

      if (titleOk && ageOk && mediumOk) { step3Already++; continue; }

      console.log(`  ↩  ID ${id}: "${current.title}" → "${backup.title}"`);
      if (!DRY_RUN) {
        await client.query(
          `UPDATE courses SET title = $1, "ageRange" = $2, medium = $3, description = $4 WHERE id = $5`,
          [backup.title, backup.ageRange || null, backup.medium || null, backup.description || null, id],
        );
      }
      step3Updated++;
    }
    console.log(`\n  → Updated ${step3Updated} courses (${step3Already} already correct)\n`);

    // ── Commit / Rollback ─────────────────────────────────────────────────────
    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('════════════════════════════════════════════════════════════════');
      console.log('DRY RUN COMPLETE — nothing changed.  Run without --dry-run to apply.');
      console.log('════════════════════════════════════════════════════════════════');
    } else {
      await client.query('COMMIT');
      console.log('════════════════════════════════════════════════════════════════');
      console.log('✅  COMPLETE — transaction committed.');
      console.log('════════════════════════════════════════════════════════════════');
      console.log('\nNext step: run consolidate-courses.ts against ocr-output-gemini');
      console.log('to import the OCR sessions (2019-2024) once DB is verified.');
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  ERROR — rolled back, no changes made.');
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
