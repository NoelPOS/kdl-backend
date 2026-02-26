import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();
  
  // Get total sessions in database
  const totalResult = await client.query(`SELECT COUNT(*) as count FROM sessions`);
  const totalSessions = parseInt(totalResult.rows[0].count);
  
  console.log(`Total sessions in database: ${totalSessions}\n`);
  
  // Get session ID ranges
  const rangeResult = await client.query(`
    SELECT MIN(id) as min_id, MAX(id) as max_id FROM sessions
  `);
  
  console.log(`Session ID range: ${rangeResult.rows[0].min_id} to ${rangeResult.rows[0].max_id}\n`);
  
  // Check how many sessions are in each range
  const ranges = [
    { name: 'Root CSVs (1-220)', min: 1, max: 220 },
    { name: 'Root CSVs (221-349)', min: 221, max: 349 },
    { name: 'OCR CSVs (350-828)', min: 350, max: 828 },
    { name: 'After CSV import (829+)', min: 829, max: 999999 }
  ];
  
  for (const range of ranges) {
    const result = await client.query(`
      SELECT COUNT(*) as count 
      FROM sessions 
      WHERE id >= $1 AND id <= $2
    `, [range.min, range.max]);
    
    console.log(`${range.name}: ${result.rows[0].count} sessions`);
  }
  
  console.log('\n\nSample of "out of scope" sessions (created after CSV import):');
  const sampleResult = await client.query(`
    SELECT s.id, s."courseId", c.title as "courseTitle", s."createdAt"
    FROM sessions s
    LEFT JOIN courses c ON s."courseId" = c.id
    WHERE s.id > 828
    ORDER BY s.id
    LIMIT 10
  `);
  
  console.log('\nFirst 10 sessions created after CSV import:');
  for (const row of sampleResult.rows) {
    console.log(`  Session ${row.id}: courseId=${row.courseId} (${row.courseTitle}), created=${row.createdAt}`);
  }
  
  await client.end();
}

main().catch(console.error);
