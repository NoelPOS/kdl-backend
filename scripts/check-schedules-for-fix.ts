import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();
  
  console.log('Checking if schedules table can help us fix sessions 829+...\n');
  
  // Check if schedules have sessionId references
  const schedulesCheck = await client.query(`
    SELECT 
      sc.id as schedule_id,
      sc."sessionId",
      sc."courseId" as schedule_courseId,
      s."courseId" as session_courseId,
      c1.title as schedule_course_title,
      c2.title as session_course_title
    FROM schedules sc
    LEFT JOIN sessions s ON sc."sessionId" = s.id
    LEFT JOIN courses c1 ON sc."courseId" = c1.id
    LEFT JOIN courses c2 ON s."courseId" = c2.id
    WHERE s.id > 828
    LIMIT 20
  `);
  
  console.log(`Found ${schedulesCheck.rows.length} schedules linked to sessions 829+\n`);
  
  if (schedulesCheck.rows.length > 0) {
    console.log('Sample schedules:');
    for (const row of schedulesCheck.rows) {
      const match = row.schedule_courseid === row.session_courseid ? '✅' : '❌ MISMATCH';
      console.log(`  Schedule ${row.schedule_id} → Session ${row.sessionId}`);
      console.log(`    Schedule courseId: ${row.schedule_courseid} (${row.schedule_course_title})`);
      console.log(`    Session courseId:  ${row.session_courseid} (${row.session_course_title}) ${match}\n`);
    }
    
    // Count mismatches
    const mismatchResult = await client.query(`
      SELECT COUNT(*) as count
      FROM schedules sc
      LEFT JOIN sessions s ON sc."sessionId" = s.id
      WHERE s.id > 828 AND sc."courseId" != s."courseId"
    `);
    
    console.log(`\nTotal mismatches in sessions 829+: ${mismatchResult.rows[0].count}`);
    console.log('\n💡 If schedules have correct courseIds, we can use them to fix sessions!');
  } else {
    console.log('❌ No schedules found for sessions 829+');
    console.log('We need another way to fix these sessions...');
  }
  
  await client.end();
}

main().catch(console.error);
