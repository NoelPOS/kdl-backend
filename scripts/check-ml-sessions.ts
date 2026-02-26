import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();
  
  console.log('Checking Machine Learning I sessions...\n');
  
  // Get all sessions with courseId 54 (Machine Learning I)
  const mlSessions = await client.query(`
    SELECT s.id, s."courseId", c.title as "courseTitle", s."createdAt"
    FROM sessions s
    LEFT JOIN courses c ON s."courseId" = c.id
    WHERE s."courseId" = 54
    ORDER BY s.id
    LIMIT 20
  `);
  
  console.log(`Found ${mlSessions.rows.length} sessions with courseId 54 (Machine Learning I):\n`);
  
  for (const row of mlSessions.rows) {
    console.log(`Session ${row.id}: courseId=${row.courseId}, course="${row.courseTitle}", created=${row.createdAt}`);
  }
  
  // Check if these sessions are in our CSV backups
  console.log('\n\nChecking if these sessions were in CSV backups (should have been fixed)...');
  console.log('Sessions 1-349 are from root CSVs (sessions_2025.csv, sessions_2024.csv)');
  console.log('Sessions 350+ are from OCR CSVs or created after import\n');
  
  await client.end();
}

main().catch(console.error);
