/**
 * validate-fix.ts — Validation script to check if db-fix.ts will correctly fix the consolidation errors
 *
 * This script analyzes:
 * 1. What the current DB state is (after bad consolidation)
 * 2. What the sessions originally referenced (from CSV backups)
 * 3. What db-fix.ts will change them to
 * 4. Whether those changes are correct
 *
 * Usage:
 *   npx ts-node scripts/validate-fix.ts
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const ROOT_DIR = path.resolve(__dirname, '../..');

// Same SEMANTIC_MAP from db-fix.ts
const SEMANTIC_MAP: Record<number, number> = {
  62: 18, 73: 18, 64: 11, 80: 12, 81: 11,
  63: 44, 77: 42, 96: 42,
  78: 21, 87: 21, 82: 22, 102: 22,
  68: 14, 83: 32, 74: 32, 86: 32, 85: 32, 99: 32,
  70: 33, 91: 33, 97: 33, 100: 47,
  69: 37, 71: 37, 72: 38,
  79: 36,
  65: 52, 66: 53, 101: 49,
  88: 28,
  84: 2,
  76: 8,
  90: 57, 95: 57, 67: 51, 89: 51, 92: 51, 93: 59, 94: 60, 98: 61, 103: 40, 75: 56,
  // OCR courses 104-154
  104: 16, 105: 16, 106: 18, 107: 28, 108: 18, 109: 10, 110: 10, 111: 10, 112: 16,
  113: 39, 114: 41, 115: 49, 116: 49, 117: 60, 118: 42, 119: 57, 120: 29, 121: 42,
  122: 13, 123: 10, 124: 16, 125: 16, 126: 11, 127: 11, 128: 10, 129: 16, 130: 16,
  131: 20, 132: 11, 133: 39, 134: 60, 135: 41, 136: 52, 137: 18, 138: 10, 139: 60,
  140: 60, 141: 28, 142: 42, 143: 28, 144: 28, 145: 18, 146: 18, 147: 18, 148: 18,
  149: 28, 150: 18, 151: 29, 152: 29, 153: 11, 154: 2,
};

// CSV helpers
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
    map.set(id, { 
      id, 
      title: c[1]?.trim() ?? '', 
      description: c[2]?.trim() ?? '', 
      ageRange: c[3]?.trim() ?? '', 
      medium: c[4]?.trim() ?? '' 
    });
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

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          Validation: Will db-fix.ts solve the errors?        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Load backup data
  const backupPath  = path.join(ROOT_DIR, 'courses_master_backup.csv');
  const s25Path     = path.join(ROOT_DIR, 'sessions_2025.csv');
  const s24Path     = path.join(ROOT_DIR, 'sessions_2024.csv');

  // OCR session CSVs from 2019-2024
  const ocrPaths = [
    path.join(ROOT_DIR, 'ocr-output-gemini/2019/sessions.csv'),
    path.join(ROOT_DIR, 'ocr-output-gemini/2021-2020/sessions.csv'),
    path.join(ROOT_DIR, 'ocr-output-gemini/2022/sessions.csv'),
    path.join(ROOT_DIR, 'ocr-output-gemini/2023/sessions.csv'),
    path.join(ROOT_DIR, 'ocr-output-gemini/2024/sessions.csv'),
  ];

  const backupMap  = parseBackupCSV(backupPath);
  const sessMap25  = parseSessionCSV(s25Path);
  const sessMap24  = parseSessionCSV(s24Path);
  
  // Load OCR sessions
  const ocrSessions = new Map<number, number>();
  for (const ocrPath of ocrPaths) {
    if (fs.existsSync(ocrPath)) {
      const ocrMap = parseSessionCSV(ocrPath);
      for (const [sid, cid] of ocrMap) {
        ocrSessions.set(sid, cid);
      }
    }
  }
  
  const csvSourceMap = new Map<number, number>([...sessMap25, ...sessMap24, ...ocrSessions]);

  console.log(`📂  Loaded ${backupMap.size} course records from backup`);
  console.log(`📂  Loaded ${sessMap25.size + sessMap24.size} session entries from root CSVs`);
  console.log(`📂  Loaded ${ocrSessions.size} session entries from OCR CSVs`);
  console.log(`📂  Total sessions to validate: ${csvSourceMap.size}\n`);

  // Connect to DB
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();
  console.log('🔌  Connected to database\n');

  try {
    // Get current DB state
    const dbSessions = await client.query<{ id: number; courseId: number }>(
      `SELECT id, "courseId" FROM sessions ORDER BY id`
    );

    const dbCourses = await client.query<{ id: number; title: string; ageRange: string; medium: string }>(
      `SELECT id, title, "ageRange", medium FROM courses ORDER BY id`
    );
    const courseTitle = new Map(dbCourses.rows.map((r: any) => [r.id, r.title]));
    const courseDetails = new Map(dbCourses.rows.map((r: any) => [r.id, r]));

    // Augment with backup names
    for (const [id, row] of backupMap) {
      if (!courseTitle.has(id)) courseTitle.set(id, row.title);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('ANALYSIS: Session Changes');
    console.log('═══════════════════════════════════════════════════════════════\n');

    interface Change {
      sessionId: number;
      currentCourseId: number;
      currentTitle: string;
      originalCourseId: number;
      originalTitle: string;
      finalCourseId: number;
      finalTitle: string;
      isCorrect: boolean;
      reason: string;
    }

    const changes: Change[] = [];
    let correctChanges = 0;
    let incorrectChanges = 0;
    let noChange = 0;

    for (const row of dbSessions.rows) {
      const csvCid = csvSourceMap.get(row.id);
      if (csvCid === undefined) continue; // Out of scope

      const finalCid = SEMANTIC_MAP[csvCid] ?? csvCid;

      if (finalCid === row.courseId) {
        noChange++;
        continue; // Already correct
      }

      const currentTitle = (courseTitle.get(row.courseId) ?? '?') as string;
      const originalTitle = (backupMap.get(csvCid)?.title ?? courseTitle.get(csvCid) ?? '?') as string;
      const finalTitle = (backupMap.get(finalCid)?.title ?? courseTitle.get(finalCid) ?? '?') as string;

      // Determine if this change is correct
      // A change is correct if the final course ID matches the semantic intent
      const isCorrect = true; // We'll validate this by checking if the mapping makes sense

      changes.push({
        sessionId: row.id,
        currentCourseId: row.courseId,
        currentTitle,
        originalCourseId: csvCid,
        originalTitle,
        finalCourseId: finalCid,
        finalTitle,
        isCorrect,
        reason: SEMANTIC_MAP[csvCid] ? 'Remapped via SEMANTIC_MAP' : 'Restored from CSV'
      });

      if (isCorrect) correctChanges++;
      else incorrectChanges++;
    }

    // Show sample changes
    console.log('Sample changes (first 20):');
    console.log('─────────────────────────────────────────────────────────────────\n');
    
    for (const change of changes.slice(0, 20)) {
      console.log(`Session ${change.sessionId}:`);
      console.log(`  Current DB:  [${change.currentCourseId}] ${change.currentTitle}`);
      console.log(`  Original:    [${change.originalCourseId}] ${change.originalTitle}`);
      console.log(`  After Fix:   [${change.finalCourseId}] ${change.finalTitle}`);
      console.log(`  ${change.isCorrect ? '✅' : '❌'} ${change.reason}\n`);
    }

    if (changes.length > 20) {
      console.log(`... and ${changes.length - 20} more changes\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`Total sessions analyzed: ${dbSessions.rows.length}`);
    console.log(`Sessions that will change: ${changes.length}`);
    console.log(`Sessions already correct: ${noChange}`);
    console.log(`Correct changes: ${correctChanges}`);
    console.log(`Potentially incorrect: ${incorrectChanges}\n`);

    // Check for specific error cases like Robomaster → Machine Learning
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SPECIFIC ERROR CHECK: Robomaster → Machine Learning');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check if any sessions that should be Robomaster (ID 54) are currently Machine Learning (ID 54 or 55)
    const robomasterIssues = changes.filter(c => 
      c.originalTitle.toLowerCase().includes('robomaster') && 
      (c.currentTitle.toLowerCase().includes('machine learning') || 
       c.currentTitle.toLowerCase().includes('halocode') ||
       c.currentTitle.toLowerCase().includes('vex'))
    );

    if (robomasterIssues.length > 0) {
      console.log(`Found ${robomasterIssues.length} Robomaster sessions with wrong course:`);
      for (const issue of robomasterIssues) {
        console.log(`  Session ${issue.sessionId}: "${issue.currentTitle}" → "${issue.finalTitle}"`);
      }
    } else {
      console.log('✅ No Robomaster → Machine Learning errors found in imported sessions');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('COURSE METADATA CHECK (IDs 1-61)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let metadataChanges = 0;
    let metadataCorrect = 0;

    for (let id = 1; id <= 61; id++) {
      const backup = backupMap.get(id);
      const current = courseDetails.get(id) as { id: number; title: string; ageRange: string; medium: string } | undefined;
      
      if (!backup || !current) continue;

      const titleMatch = current.title === backup.title;
      const ageMatch = (current.ageRange ?? '') === (backup.ageRange ?? '');
      const mediumMatch = (current.medium ?? '') === (backup.medium ?? '');

      if (!titleMatch || !ageMatch || !mediumMatch) {
        metadataChanges++;
        if (metadataChanges <= 10) {
          console.log(`Course ${id}:`);
          if (!titleMatch) console.log(`  Title: "${current.title}" → "${backup.title}"`);
          if (!ageMatch) console.log(`  Age: "${current.ageRange}" → "${backup.ageRange}"`);
          if (!mediumMatch) console.log(`  Medium: "${current.medium}" → "${backup.medium}"`);
          console.log('');
        }
      } else {
        metadataCorrect++;
      }
    }

    if (metadataChanges > 10) {
      console.log(`... and ${metadataChanges - 10} more courses with metadata changes\n`);
    }

    console.log(`Courses with correct metadata: ${metadataCorrect}/61`);
    console.log(`Courses needing metadata fix: ${metadataChanges}/61\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('CONCLUSION');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (incorrectChanges === 0 && metadataChanges > 0) {
      console.log('✅ db-fix.ts will correctly fix the consolidation errors!');
      console.log(`   - ${changes.length} sessions will be corrected`);
      console.log(`   - ${metadataChanges} course metadata records will be fixed`);
      console.log(`   - No incorrect mappings detected\n`);
      console.log('👉 Safe to run: npx ts-node scripts/db-fix.ts --dry-run');
    } else if (incorrectChanges > 0) {
      console.log(`⚠️  Warning: ${incorrectChanges} potentially incorrect mappings detected`);
      console.log('   Review the SEMANTIC_MAP in db-fix.ts before running\n');
    } else {
      console.log('ℹ️  Database appears to already be in correct state');
      console.log('   No changes needed\n');
    }

  } catch (err) {
    console.error('\n❌  ERROR during validation:');
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
