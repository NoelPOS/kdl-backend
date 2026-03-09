import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  // 1. Raw sessions rows
  console.log('\n─── Sample sessions rows (raw) ───');
  const raw = await pool.query(`SELECT id, "studentId", "courseId" FROM sessions LIMIT 5`);
  console.table(raw.rows);

  // 2. JOIN sessions.studentId → students.id  (auto-increment PK)
  console.log('\n─── JOIN via students.id (auto-increment PK) ───');
  const r1 = await pool.query(`
    SELECT s.id AS session_id, s."studentId" AS sess_studentId,
           st.id AS st_pk, st."studentId" AS st_studentId_col, st.name
    FROM sessions s
    LEFT JOIN students st ON st.id = s."studentId"
    LIMIT 5
  `);
  console.table(r1.rows);

  // 3. JOIN sessions.studentId → students.studentId column (the "202503001" string cast to int)
  console.log('\n─── JOIN via students.studentId col (cast) ───');
  const r2 = await pool.query(`
    SELECT s.id AS session_id, s."studentId" AS sess_studentId,
           st.id AS st_pk, st."studentId" AS st_studentId_col, st.name
    FROM sessions s
    LEFT JOIN students st ON st."studentId" = CAST(s."studentId" AS text)
    LIMIT 5
  `);
  console.table(r2.rows);

  // 4. Verdict
  const pkMatches  = r1.rows.filter(r => r.name !== null).length;
  const sidMatches = r2.rows.filter(r => r.name !== null).length;
  console.log(`\n  Matched via students.id (PK)       : ${pkMatches}/5`);
  console.log(`  Matched via students.studentId col : ${sidMatches}/5`);

  if (pkMatches >= sidMatches) {
    console.log('\n→ sessions.studentId stores the AUTO-INCREMENT PK (students.id)');
    console.log('→ Script must map "202503001" string → students.id before inserting ✓');
  } else {
    console.log('\n→ sessions.studentId stores the FORMATTED ID (202503001 as integer)');
    console.log('→ Script can store the CSV studentId directly as integer — no mapping needed');
  }
}

main().catch(console.error).finally(() => pool.end());
