/**
 * One-off repair: rebuilds teacher_courses from sessions + schedules.
 * Run after leo-inject wipes it via TRUNCATE courses ... CASCADE.
 *
 *   npx ts-node scripts/repair-teacher-courses.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // Check current count
    const before = await client.query('SELECT COUNT(*) FROM teacher_courses');
    console.log('teacher_courses before:', before.rows[0].count);

    const result = await client.query(`
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
    console.log(`✅ Inserted ${result.rowCount} teacher_courses rows.`);

    const after = await client.query('SELECT COUNT(*) FROM teacher_courses');
    console.log('teacher_courses after:', after.rows[0].count);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
