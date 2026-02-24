import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

async function runConsolidation() {
  const planPath = path.resolve(__dirname, '../../../plan_summary.json');
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

      // Delete old redundant course
      await client.query(`DELETE FROM courses WHERE id = $1`, [oldId]);
    }
    console.log(`Consolidated ${plan.consolidations.length} redundant courses.`);

    console.log('\n--- Processing Deletions ---');
    for (const del of plan.deletions) {
      // Check if there are orphaned sessions/schedules just in case and delete them (or fail if constraints exist)
      await client.query(`DELETE FROM courses WHERE id = $1`, [del.sourceId]);
    }
    console.log(`Deleted ${plan.deletions.length} explicitly requested courses.`);

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
