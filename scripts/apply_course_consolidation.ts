import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

async function runConsolidation() {
  const planPath = 'C:/Users/Saw/Desktop/kdl-lms/kdl-backend/plan_summary.json';
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query('BEGIN');

    console.log('--- Updating Canonical Masters 1-61 ---');
    for (const update of plan.updatesToMaster) {
      await client.query(
        `UPDATE courses SET title = $1, "ageRange" = $2, medium = $3 WHERE id = $4`,
        [update.newTitle, update.newAge, update.newMedium, update.id],
      );
    }
    console.log(`Updated ${plan.updatesToMaster.length} master courses.`);

    console.log('\n--- Consolidating Redundant Courses ---');
    for (const cons of plan.consolidations) {
      const oldId = cons.sourceId;
      const newId = cons.targetId;

      // Move dependencies to the new target ID
      await client.query(`UPDATE sessions SET "courseId" = $1 WHERE "courseId" = $2`, [newId, oldId]);
      await client.query(`UPDATE schedules SET "courseId" = $1 WHERE "courseId" = $2`, [newId, oldId]);
      await client.query(`UPDATE teacher_courses SET "courseId" = $1 WHERE "courseId" = $2`, [newId, oldId]);

      // Delete old redundant course BUT ONLY IF IT IS NOT a canonical 1-61 ID.
      // E.g. If an old mapping had oldId=60 mapping to 10, we move the sessions, but we DON'T delete ID 60 because ID 60 is strictly kept as a master course.
      if (oldId > 61) {
        await client.query(`DELETE FROM courses WHERE id = $1`, [oldId]);
      } else {
        console.log(`Skipped deleting ID ${oldId} for consolidation because it is a Canonical 1-61 course. Its old sessions were successfully moved to ID ${newId}.`);
      }
    }
    console.log(`Consolidated ${plan.consolidations.length} redundant courses.`);

    console.log('\n--- Processing Deletions ---');
    for (const del of plan.deletions) {
      if (del.sourceId > 61) {
        await client.query(`DELETE FROM course_plus WHERE "sessionId" IN (SELECT id FROM sessions WHERE "courseId" = $1)`, [del.sourceId]);
        await client.query(`DELETE FROM schedules WHERE "sessionId" IN (SELECT id FROM sessions WHERE "courseId" = $1)`, [del.sourceId]);
        await client.query(`DELETE FROM sessions WHERE "courseId" = $1`, [del.sourceId]);
        await client.query(`DELETE FROM schedules WHERE "courseId" = $1`, [del.sourceId]);
        await client.query(`DELETE FROM teacher_courses WHERE "courseId" = $1`, [del.sourceId]);
        await client.query(`DELETE FROM courses WHERE id = $1`, [del.sourceId]);
      } else {
        console.log(`Skipped explicitly deleting ID ${del.sourceId} because it is a Canonical 1-61 course.`);
      }
    }
    console.log(`Processed ${plan.deletions.length} explicit deletions.`);

    await client.query('COMMIT');
    console.log('\nSUCCESS! Database changes committed successfully.');
    console.log(`Final Result: 61 canonical courses + ${plan.leftAloneExtra.length} untouched package/extra courses will remain in the database.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\nERROR OCCURRED, TRANSACTION ROLLED BACK. No changes were made to the database.', error);
  } finally {
    await client.end();
  }
}

runConsolidation().catch(console.error);
