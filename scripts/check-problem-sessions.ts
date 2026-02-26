import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const ROOT_DIR = path.resolve(__dirname, '../..');

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

function parseSessionCSV(filePath: string): Map<number, number> {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
  if (lines.length < 2) return new Map();
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const sidIdx  = headers.indexOf('sessionId');
  const cidIdx  = headers.indexOf('courseId');
  if (sidIdx === -1 || cidIdx === -1) return new Map();
  const map = new Map<number, number>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const sid  = parseInt(cols[sidIdx], 10);
    const cid  = parseInt(cols[cidIdx], 10);
    if (!isNaN(sid) && !isNaN(cid)) map.set(sid, cid);
  }
  return map;
}

async function main() {
  console.log('Checking for sessions with wrong courseIds...\n');

  // Load CSV backups
  const s25Path = path.join(ROOT_DIR, 'sessions_2025.csv');
  const s24Path = path.join(ROOT_DIR, 'sessions_2024.csv');
  
  const sessMap25 = parseSessionCSV(s25Path);
  const sessMap24 = parseSessionCSV(s24Path);
  const csvSourceMap = new Map<number, number>([...sessMap25, ...sessMap24]);

  console.log(`Loaded ${csvSourceMap.size} sessions from CSV backups\n`);

  // Connect to database
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  // Get current sessions
  const dbSessions = await client.query(`
    SELECT s.id, s."courseId", c.title as "courseTitle"
    FROM sessions s
    LEFT JOIN courses c ON s."courseId" = c.id
    WHERE s.id <= 349
    ORDER BY s.id
    LIMIT 20
  `);

  console.log('Sample of first 20 sessions:\n');
  console.log('SessionID | DB CourseID | DB Course Title | CSV CourseID | Match?');
  console.log('----------|-------------|-----------------|--------------|-------');

  let mismatchCount = 0;
  
  for (const row of dbSessions.rows) {
    const csvCid = csvSourceMap.get(row.id);
    const match = csvCid === row.courseId ? '✅' : '❌';
    
    if (csvCid !== row.courseId) {
      mismatchCount++;
      console.log(`${row.id.toString().padEnd(9)} | ${row.courseId.toString().padEnd(11)} | ${(row.courseTitle || '?').padEnd(15)} | ${(csvCid || '?').toString().padEnd(12)} | ${match}`);
    }
  }

  console.log(`\n❌ Found ${mismatchCount} mismatches in first 20 sessions`);
  
  // Count total mismatches
  const totalCheck = await client.query(`
    SELECT COUNT(*) as count
    FROM sessions
    WHERE id <= 349
  `);
  
  console.log(`\n📊 Total sessions in database (1-349): ${totalCheck.rows[0].count}`);
  console.log(`📊 Sessions in CSV backup: ${csvSourceMap.size}`);

  await client.end();
}

main().catch(console.error);
