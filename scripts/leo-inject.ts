/**
 * Leo Data Injection Script
 *
 * Full reset + inject for courses, sessions, schedules from the leo/ folder.
 * Students from the 2025-Active inject file are UPSERTed (insert new, update existing).
 *
 * KEY DESIGN NOTES:
 *   - sessions.studentId  = students.id (DB auto-increment PK), NOT the "202503001" string
 *   - schedules.studentId = same as above
 *   - sessions.courseId   = courses.id  (we force-insert courses with their CSV ids, so these match)
 *   - classOptionId defaults to 1 when empty (NOT NULL column)
 *   - payment  defaults to 'Paid' (historical) / 'Pending' (active) when empty
 *   - status   defaults to 'completed' (historical) / 'active' (active) when empty
 *   - schedules.sessionId is remapped via csvSessionId→newDbId map built during active-session insert
 *
 * Execution order:
 *   1. UPSERT students from inject file → build studentId-string → db.id map
 *   2. Query ALL existing students to extend the map (needed for historical sessions)
 *   3. TRUNCATE schedules → sessions → courses  (RESTART IDENTITY CASCADE)
 *   4. INSERT 63 courses with forced IDs, reset sequence
 *   5. Batch INSERT historical sessions (2019, 2020-21, 2022, 2023, 2024, 2025-completed)
 *   6. INSERT 2025-active sessions via RETURNING id → build csvSessionId→dbId map
 *   7. INSERT schedules with remapped sessionIds + mapped studentIds
 *   8. Rebuild teacher_courses from DISTINCT (teacherId, courseId) pairs in sessions + schedules
 *
 * Usage:
 *   cd kdl-backend
 *   npx ts-node scripts/leo-inject.ts           # live run
 *   npx ts-node scripts/leo-inject.ts --dry-run  # preview only (no DB writes)
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Pool, PoolClient } from 'pg';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const LEO_DIR = path.join(__dirname, '..', '..', 'leo');

const FILES = {
  courses:             path.join(LEO_DIR, 'KDL 2019-2024 - Correct courses.csv'),
  sessions2019:        path.join(LEO_DIR, 'KDL 2019-2024 - Correct 2019 sessions.csv'),
  sessions2021:        path.join(LEO_DIR, 'KDL 2019-2024 - Correct 2021-2020 sessions.csv'),
  sessions2022:        path.join(LEO_DIR, 'KDL 2019-2024 - Correct 2022 sessions.csv'),
  sessions2023:        path.join(LEO_DIR, 'KDL 2019-2024 - Correct 2023 sessions.csv'),
  sessions2024:        path.join(LEO_DIR, 'KDL 2019-2024 - Correct 2024 sessions.csv'),
  sessions2025comp:    path.join(LEO_DIR, '2025 completed of KDL Conversion - Correct sessions.csv'),
  sessions2025act:     path.join(LEO_DIR, 'Inject to DB _ 2025 Active - Correct sessions.csv'),
  schedules2025act:    path.join(LEO_DIR, 'Inject to DB _ 2025 Active - Correct schedules.csv'),
  students2025comp:    path.join(LEO_DIR, '2025 completed of KDL Conversion - students.csv'),
  studentsInject:      path.join(LEO_DIR, 'Inject to DB _ 2025 Active - students.csv'),
};

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

function parseCSV(filePath: string): Record<string, string>[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠  File not found: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const rawLines = content.split('\n');
  const lines = rawLines.map(l => l.trimEnd()).filter(l => l.length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const headers = parseLine(headerLine).map(h => h.trim());

  const records: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (values[idx] ?? '').trim();
    });
    records.push(record);
  }
  return records;
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

function intOrNull(v: string | undefined): number | null {
  if (!v || v.trim() === '' || v.trim().toUpperCase() === 'NULL') return null;
  const n = parseInt(v.trim(), 10);
  return isNaN(n) ? null : n;
}

function intOrDefault(v: string | undefined, def: number): number {
  return intOrNull(v) ?? def;
}

function strVal(v: string | undefined): string {
  return (v ?? '').trim();
}

function strOrDefault(v: string | undefined, def: string): string {
  const s = (v ?? '').trim();
  return s === '' || s.toUpperCase() === 'NULL' ? def : s;
}

function nullableStr(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  return s === '' || s.toUpperCase() === 'NULL' ? null : s;
}

function boolFromStr(v: string | undefined): boolean {
  const s = (v ?? '').trim().toUpperCase();
  return s === 'TRUE' || s === '1' || s === 'YES';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log(` Leo Inject Script${DRY_RUN ? '  [DRY-RUN – no DB changes]' : ''}`);
  console.log('='.repeat(60));

  // ── 1. Load all CSVs ────────────────────────────────────────────────────
  console.log('\n📂 Loading CSV files…');

  const courses           = parseCSV(FILES.courses);
  const sess2019          = parseCSV(FILES.sessions2019);
  const sess2021          = parseCSV(FILES.sessions2021);
  const sess2022          = parseCSV(FILES.sessions2022);
  const sess2023          = parseCSV(FILES.sessions2023);
  const sess2024          = parseCSV(FILES.sessions2024);
  const sess2025comp      = parseCSV(FILES.sessions2025comp);
  const sess2025act       = parseCSV(FILES.sessions2025act);
  const sched2025act      = parseCSV(FILES.schedules2025act);
  const students2025comp  = parseCSV(FILES.students2025comp);
  const studentsInject    = parseCSV(FILES.studentsInject);

  const historicalSessions = [
    { label: '2019',      rows: sess2019,     defPayment: 'Paid', defStatus: 'completed' },
    { label: '2020-2021', rows: sess2021,     defPayment: 'Paid', defStatus: 'completed' },
    { label: '2022',      rows: sess2022,     defPayment: 'Paid', defStatus: 'completed' },
    { label: '2023',      rows: sess2023,     defPayment: 'Paid', defStatus: 'completed' },
    { label: '2024',      rows: sess2024,     defPayment: 'Paid', defStatus: 'completed' },
    { label: '2025-comp', rows: sess2025comp, defPayment: 'Paid', defStatus: 'completed' },
  ];

  console.log(`  courses          : ${courses.length}`);
  historicalSessions.forEach(s => console.log(`  sessions ${s.label.padEnd(9)}: ${s.rows.length}`));
  console.log(`  sessions 2025-act: ${sess2025act.length}`);
  console.log(`  schedules 2025   : ${sched2025act.length}`);
  console.log(`  students 2025-cmp: ${students2025comp.length}`);
  console.log(`  students inject  : ${studentsInject.length}`);

  if (DRY_RUN) {
    console.log('\n✅ Dry-run complete – no DB writes performed.');
    return;
  }

  // ── 2. Connect ──────────────────────────────────────────────────────────
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client: PoolClient = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 3. UPSERT students FIRST → build studentIdString→dbId map ────────
    // Must happen before sessions so new students get DB ids we can reference.
    // Map: students.studentId string (e.g. "202503001") → students.id (auto-increment PK)
    const studentDbIdMap = new Map<string, number>();

    /** Upsert a batch of student rows and extend studentDbIdMap. */
    async function upsertStudents(rows: Record<string, string>[], label: string) {
      let inserted = 0, updated = 0, skipped = 0;
      for (const row of rows) {
        const studentId = strVal(row['studentId']);
        const name      = strVal(row['name']);
        if (!studentId || !name) { skipped++; continue; }

        const allergic = row['allergic'] ? row['allergic'].split(',').map(s => s.trim()).filter(Boolean) : [];
        const doNotEat = row['doNotEat'] ? row['doNotEat'].split(',').map(s => s.trim()).filter(Boolean) : [];

        const result = await client.query<{ id: number; inserted: boolean }>(
          `INSERT INTO students
             ("studentId", name, nickname, "nationalId", dob, gender, school,
              allergic, "doNotEat", "adConcent", phone, "profilePicture")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT ("studentId") DO UPDATE SET
             name         = EXCLUDED.name,
             nickname     = EXCLUDED.nickname,
             "nationalId" = EXCLUDED."nationalId",
             dob          = EXCLUDED.dob,
             gender       = EXCLUDED.gender,
             school       = EXCLUDED.school,
             allergic     = EXCLUDED.allergic,
             "doNotEat"   = EXCLUDED."doNotEat",
             "adConcent"  = EXCLUDED."adConcent",
             phone        = EXCLUDED.phone
           RETURNING id, (xmax = 0) AS inserted`,
          [
            studentId,
            name,
            strVal(row['nickname']),
            nullableStr(row['nationalId']),
            strVal(row['dob']),           // NOT NULL varchar → use strVal, not nullableStr
            strVal(row['gender']),
            strVal(row['school']),
            allergic,
            doNotEat,
            false,
            strVal(row['phone']),
            '',
          ],
        );
        const dbId = result.rows[0].id;
        studentDbIdMap.set(studentId, dbId);
        if (result.rows[0].inserted) inserted++; else updated++;
      }
      console.log(`   [${label}] Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`);
    }

    console.log(`\n👤 Upserting students…`);
    await upsertStudents(students2025comp, '2025-completed students');
    await upsertStudents(studentsInject,   '2025-active students');

    // ── 4. Load ALL existing students into the map ─────────────────────
    // Historical sessions reference old students (201901xxx, 202201xxx etc.) that are already in DB.
    console.log('\n🔍 Loading all existing students for ID mapping…');
    const allStudents = await client.query<{ id: number; studentId: string }>(
      `SELECT id, "studentId" FROM students WHERE "studentId" IS NOT NULL`,
    );
    let newMappings = 0;
    for (const row of allStudents.rows) {
      if (!studentDbIdMap.has(row.studentId)) {
        studentDbIdMap.set(row.studentId, row.id);
        newMappings++;
      }
    }
    console.log(`   Loaded ${allStudents.rows.length} students total (${newMappings} new mappings added).`);

    // ── 5. Truncate courses / sessions / schedules ─────────────────────
    console.log('\n🗑️  Truncating schedules → sessions → courses…');
    await client.query('TRUNCATE TABLE schedules RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE sessions  RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE courses   RESTART IDENTITY CASCADE');
    console.log('   Done.');

    // ── 6. Insert courses with forced IDs ──────────────────────────────
    console.log(`\n📚 Inserting ${courses.length} courses…`);
    for (const row of courses) {
      const id = intOrNull(row['id']);
      if (!id) continue;
      await client.query(
        `INSERT INTO courses (id, title, description, "ageRange", medium)
         OVERRIDING SYSTEM VALUE
         VALUES ($1, $2, $3, $4, $5)`,
        [id, strVal(row['title']), strVal(row['description']), strVal(row['ageRange']), strVal(row['medium'])],
      );
    }
    await client.query(`SELECT setval('courses_id_seq', (SELECT MAX(id) FROM courses))`);
    console.log('   Done.');

    // ── Load valid class_option IDs from DB ────────────────────────────
    const coRows = await client.query<{ id: number }>('SELECT id FROM class_options');
    const validClassOptionIds = new Set<number>(coRows.rows.map(r => r.id));
    console.log(`\n🔑 Valid classOptionIds: [${[...validClassOptionIds].sort((a: number, b: number) => a - b).join(', ')}]`);

    /** Return classOptionId if it exists in DB, otherwise fall back to 1 and log a warning. */
    function resolveClassOptionId(v: string | undefined, context: string): number {
      const n = intOrNull(v);
      if (n === null) return 1;                          // empty → default 1
      if (validClassOptionIds.has(n)) return n;
      console.warn(`   ⚠  ${context}: classOptionId=${n} not in DB – defaulting to 1`);
      return 1;
    }

    // Helper: resolve studentId string → DB id, with warning on miss
    function resolveStudentId(csvStudentId: string, context: string): number | null {
      const dbId = studentDbIdMap.get(csvStudentId.trim());
      if (!dbId) {
        console.warn(`   ⚠  ${context}: student "${csvStudentId}" not found in DB – row skipped`);
        return null;
      }
      return dbId;
    }

    // ── 7. Insert historical + completed sessions ──────────────────────
    console.log('\n📋 Inserting historical sessions…');
    for (const { label, rows, defPayment, defStatus } of historicalSessions) {
      let count = 0, skipped = 0;
      for (const row of rows) {
        const csvStudentId = strVal(row['studentId']);
        const courseId     = intOrNull(row['courseId']);
        if (!csvStudentId || !courseId) { skipped++; continue; }

        const dbStudentId = resolveStudentId(csvStudentId, `${label} session`);
        if (!dbStudentId) { skipped++; continue; }

        await client.query(
          `INSERT INTO sessions
             ("studentId", "courseId", "classOptionId", "classCancel",
              payment, status, "teacherId", "invoiceDone", "packageGroupId", comment)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            dbStudentId,
            courseId,
            resolveClassOptionId(row['classOptionId'], `${label} session`),
            intOrDefault(row['classCancel'], 0),
            strOrDefault(row['payment'], defPayment),    // NOT NULL → default 'Paid'
            strOrDefault(row['status'],  defStatus),     // NOT NULL → default 'completed'
            intOrNull(row['teacherId']),
            boolFromStr(row['InvoiceDone']),
            intOrNull(row['packageGroupId']),
            null,
          ],
        );
        count++;
      }
      console.log(`   ${label}: inserted ${count}, skipped ${skipped}`);
    }

    // ── 8. Insert 2025-active sessions + build csvSessionId→dbId map ───
    console.log(`\n📋 Inserting ${sess2025act.length} active-2025 sessions…`);
    const sessionIdMap = new Map<string, number>(); // CSV sessionId → new DB sessions.id
    let sessOk = 0, sessSkipped = 0;

    for (const row of sess2025act) {
      const csvSessionId = strVal(row['sessionId']);
      const csvStudentId = strVal(row['studentId']);
      const courseId     = intOrNull(row['courseId']);
      if (!csvStudentId || !courseId) { sessSkipped++; continue; }

      const dbStudentId = resolveStudentId(csvStudentId, `active session ${csvSessionId}`);
      if (!dbStudentId) { sessSkipped++; continue; }

      const result = await client.query<{ id: number }>(
        `INSERT INTO sessions
           ("studentId", "courseId", "classOptionId", "classCancel",
            payment, status, "teacherId", "invoiceDone", "packageGroupId", comment)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          dbStudentId,
          courseId,
          resolveClassOptionId(row['classOptionId'], `active session ${csvSessionId}`),
          intOrDefault(row['classCancel'], 0),
          strOrDefault(row['payment'],     'Pending'),
          strOrDefault(row['status'],      'active'),
          intOrNull(row['teacherId']),
          boolFromStr(row['InvoiceDone']),
          intOrNull(row['packageGroupId']),
          nullableStr(row['Remark']),
        ],
      );
      const newDbId = result.rows[0].id;
      if (csvSessionId) sessionIdMap.set(csvSessionId, newDbId);
      sessOk++;
    }
    console.log(`   Done. Inserted: ${sessOk}, Skipped: ${sessSkipped}. Mapped ${sessionIdMap.size} session IDs.`);

    // ── 9. Insert schedules with remapped sessionIds ───────────────────
    console.log(`\n📅 Inserting ${sched2025act.length} schedule rows…`);
    let schedOk = 0, schedSkipped = 0;

    for (const row of sched2025act) {
      const csvSessId    = strVal(row['sessionId']);
      const csvStudentId = strVal(row['studentId']);
      const courseId     = intOrNull(row['courseId']);

      const dbSessId = sessionIdMap.get(csvSessId);
      if (!dbSessId) {
        if (csvSessId) console.warn(`   ⚠  Schedule: unknown csvSessionId=${csvSessId} – skipped`);
        schedSkipped++;
        continue;
      }
      if (!csvStudentId || !courseId) { schedSkipped++; continue; }

      const dbStudentId = resolveStudentId(csvStudentId, `schedule (session ${csvSessId})`);
      if (!dbStudentId) { schedSkipped++; continue; }

      // Normalise attendance: TBD → Pending
      let attendance = strOrDefault(row['attendance'], 'Pending');
      if (attendance === 'TBD') attendance = 'Pending';

      await client.query(
        `INSERT INTO schedules
           ("sessionId", "studentId", "courseId", "teacherId",
            date, "startTime", "endTime", room,
            attendance, remark, warning, feedback, "verifyFb")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          dbSessId,
          dbStudentId,
          courseId,
          intOrNull(row['teacherId']),
          nullableStr(row['date']),
          nullableStr(row['startTime']),
          nullableStr(row['endTime']),
          strVal(row['room']),         // NOT NULL varchar → '' is fine
          attendance,
          strVal(row['remark']),
          '',     // warning  – NOT NULL, default ''
          '',     // feedback – NOT NULL, default ''
          false,  // verifyFb – NOT NULL, default false
        ],
      );
      schedOk++;
    }
    console.log(`   Done. Inserted: ${schedOk}, Skipped: ${schedSkipped}`);

    // ── 10. Rebuild teacher_courses from sessions + schedules ─────────
    // TRUNCATE courses ... CASCADE wiped teacher_courses. Repopulate from
    // the teacherId/courseId pairs now present in sessions and schedules.
    console.log('\n🔗 Rebuilding teacher_courses…');
    const tcResult = await client.query(`
      INSERT INTO teacher_courses ("teacherId", "courseId")
      SELECT DISTINCT t."teacherId", t."courseId"
      FROM (
        SELECT "teacherId", "courseId" FROM sessions  WHERE "teacherId" IS NOT NULL AND "courseId" IS NOT NULL
        UNION
        SELECT "teacherId", "courseId" FROM schedules WHERE "teacherId" IS NOT NULL AND "courseId" IS NOT NULL
      ) t
      WHERE NOT EXISTS (
        SELECT 1 FROM teacher_courses tc
        WHERE tc."teacherId" = t."teacherId" AND tc."courseId" = t."courseId"
      )
    `);
    console.log(`   Done. Inserted ${tcResult.rowCount} teacher_courses rows.`);

    // ── 11. Commit ────────────────────────────────────────────────────
    await client.query('COMMIT');
    console.log('\n✅ All done – transaction committed.');

    // ── Summary ──────────────────────────────────────────────────────
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM courses)   AS courses,
        (SELECT COUNT(*) FROM sessions)  AS sessions,
        (SELECT COUNT(*) FROM schedules) AS schedules,
        (SELECT COUNT(*) FROM students)  AS students
    `);
    const c = counts.rows[0];
    console.log('\n📊 Final row counts:');
    console.log(`   courses  : ${c.courses}`);
    console.log(`   sessions : ${c.sessions}`);
    console.log(`   schedules: ${c.schedules}`);
    console.log(`   students : ${c.students}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error – transaction rolled back.');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
