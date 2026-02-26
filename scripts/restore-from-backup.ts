/**
 * restore-from-backup.ts — Restore database from backup
 *
 * This script restores the database from a backup created by backup-before-fix.ts
 *
 * Usage:
 *   npx ts-node scripts/restore-from-backup.ts [backup-timestamp]
 *   
 * If no timestamp provided, lists available backups
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const ROOT_DIR = path.resolve(__dirname, '../..');
const BACKUP_DIR = path.join(ROOT_DIR, 'db-backup-before-fix');

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

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('❌  No backups found. Run backup-before-fix.ts first.\n');
    return [];
  }

  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => fs.statSync(path.join(BACKUP_DIR, f)).isDirectory())
    .sort()
    .reverse();

  if (backups.length === 0) {
    console.log('❌  No backups found. Run backup-before-fix.ts first.\n');
    return [];
  }

  console.log('\n📁  Available backups:\n');
  backups.forEach((backup, idx) => {
    const metadataPath = path.join(BACKUP_DIR, backup, 'backup-metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      console.log(`   ${idx + 1}. ${backup}`);
      console.log(`      Created: ${new Date(metadata.timestamp).toLocaleString()}`);
      console.log(`      Records: ${Object.values(metadata.tables).reduce((a: any, b: any) => a + b, 0)}`);
      console.log('');
    }
  });

  return backups;
}

async function restore(backupTimestamp: string) {
  const backupPath = path.join(BACKUP_DIR, backupTimestamp);

  if (!fs.existsSync(backupPath)) {
    console.error(`❌  Backup not found: ${backupPath}\n`);
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              Database Restore - DANGER ZONE                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`⚠️   This will OVERWRITE your current database with backup from:`);
  console.log(`     ${backupTimestamp}\n`);

  // Load metadata
  const metadataPath = path.join(backupPath, 'backup-metadata.json');
  if (fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    console.log(`📊  Backup info:`);
    console.log(`     Created: ${new Date(metadata.timestamp).toLocaleString()}`);
    console.log(`     Sessions: ${metadata.tables.sessions}`);
    console.log(`     Courses: ${metadata.tables.courses}`);
    console.log(`     Schedules: ${metadata.tables.schedules}`);
    console.log(`     Teacher Courses: ${metadata.tables.teacher_courses}\n`);
  }

  console.log('⏳  Starting restore in 5 seconds... (Ctrl+C to cancel)\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const client = new Client({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();
  console.log('🔌  Connected to database\n');

  try {
    await client.query('BEGIN');

    // ═══════════════════════════════════════════════════════════════
    // Restore Sessions
    // ═══════════════════════════════════════════════════════════════
    console.log('📥  Restoring sessions...');
    const sessionsPath = path.join(backupPath, 'sessions.csv');
    const sessionsLines = fs.readFileSync(sessionsPath, 'utf-8').split('\n').filter(l => l.trim());
    
    for (let i = 1; i < sessionsLines.length; i++) {
      const cols = parseCSVLine(sessionsLines[i]);
      const id = parseInt(cols[0], 10);
      const courseId = cols[2] ? parseInt(cols[2], 10) : null;
      
      if (isNaN(id)) continue;

      await client.query(`
        UPDATE sessions 
        SET "courseId" = $1
        WHERE id = $2
      `, [courseId, id]);
    }
    console.log(`   ✅ Restored ${sessionsLines.length - 1} sessions\n`);

    // ═══════════════════════════════════════════════════════════════
    // Restore Courses
    // ═══════════════════════════════════════════════════════════════
    console.log('📥  Restoring courses...');
    const coursesPath = path.join(backupPath, 'courses.csv');
    const coursesLines = fs.readFileSync(coursesPath, 'utf-8').split('\n').filter(l => l.trim());
    
    for (let i = 1; i < coursesLines.length; i++) {
      const cols = parseCSVLine(coursesLines[i]);
      const id = parseInt(cols[0], 10);
      
      if (isNaN(id)) continue;

      await client.query(`
        UPDATE courses 
        SET title = $1, description = $2, "ageRange" = $3, medium = $4
        WHERE id = $5
      `, [
        cols[1] || null,
        cols[2] || null,
        cols[3] || null,
        cols[4] || null,
        id
      ]);
    }
    console.log(`   ✅ Restored ${coursesLines.length - 1} courses\n`);

    await client.query('COMMIT');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅  RESTORE COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('✅  Database has been restored to backup state\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  ERROR during restore - rolled back:');
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function main() {
  const backupTimestamp = process.argv[2];

  if (!backupTimestamp) {
    const backups = listBackups();
    if (backups.length > 0) {
      console.log('💡  To restore a backup, run:');
      console.log(`     npx ts-node scripts/restore-from-backup.ts ${backups[0]}\n`);
    }
    return;
  }

  await restore(backupTimestamp);
}

main().catch(console.error);
