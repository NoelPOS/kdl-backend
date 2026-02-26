/**
 * backup-before-fix.ts — Create complete backup before running db-fix.ts
 *
 * This script exports the current database state to CSV files so you can
 * restore if anything goes wrong.
 *
 * Usage:
 *   npx ts-node scripts/backup-before-fix.ts
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const ROOT_DIR = path.resolve(__dirname, '../..');
const BACKUP_DIR = path.join(ROOT_DIR, 'db-backup-before-fix');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         Database Backup Before Fix - Creating Snapshot        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Create backup directory
  const backupPath = path.join(BACKUP_DIR, TIMESTAMP);
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }

  console.log(`📁  Backup directory: ${backupPath}\n`);

  // Connect to database
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();
  console.log('🔌  Connected to database\n');

  try {
    // ═══════════════════════════════════════════════════════════════
    // Backup 1: Sessions Table
    // ═══════════════════════════════════════════════════════════════
    console.log('📦  Backing up sessions table...');
    const sessions = await client.query(`
      SELECT id, "studentId", "courseId", "classOptionId", "classCancel", 
             payment, status, "teacherId", "invoiceDone", "packageGroupId"
      FROM sessions 
      ORDER BY id
    `);
    
    const sessionsCsv = [
      'id,studentId,courseId,classOptionId,classCancel,payment,status,teacherId,invoiceDone,packageGroupId',
      ...sessions.rows.map((r: any) => 
        `${r.id},${r.studentId},${r.courseId ?? ''},${r.classOptionId ?? ''},${r.classCancel ?? ''},${r.payment ?? ''},${r.status ?? ''},${r.teacherId ?? ''},${r.invoiceDone ?? ''},${r.packageGroupId ?? ''}`
      )
    ].join('\n');
    
    fs.writeFileSync(path.join(backupPath, 'sessions.csv'), sessionsCsv);
    console.log(`   ✅ Backed up ${sessions.rows.length} sessions\n`);

    // ═══════════════════════════════════════════════════════════════
    // Backup 2: Courses Table
    // ═══════════════════════════════════════════════════════════════
    console.log('📦  Backing up courses table...');
    const courses = await client.query(`
      SELECT id, title, description, "ageRange", medium
      FROM courses 
      ORDER BY id
    `);
    
    const coursesCsv = [
      'id,title,description,ageRange,medium',
      ...courses.rows.map((r: any) => 
        `${r.id},"${(r.title ?? '').replace(/"/g, '""')}","${(r.description ?? '').replace(/"/g, '""')}","${r.ageRange ?? ''}","${r.medium ?? ''}"`
      )
    ].join('\n');
    
    fs.writeFileSync(path.join(backupPath, 'courses.csv'), coursesCsv);
    console.log(`   ✅ Backed up ${courses.rows.length} courses\n`);

    // ═══════════════════════════════════════════════════════════════
    // Backup 3: Schedules Table
    // ═══════════════════════════════════════════════════════════════
    console.log('📦  Backing up schedules table...');
    const schedules = await client.query(`
      SELECT id, "sessionId", "courseId", "studentId", "teacherId", 
             date, "startTime", "endTime", room, attendance, remark
      FROM schedules 
      ORDER BY id
    `);
    
    const schedulesCsv = [
      'id,sessionId,courseId,studentId,teacherId,date,startTime,endTime,room,attendance,remark',
      ...schedules.rows.map((r: any) => 
        `${r.id},${r.sessionId ?? ''},${r.courseId ?? ''},${r.studentId ?? ''},${r.teacherId ?? ''},${r.date ?? ''},${r.startTime ?? ''},${r.endTime ?? ''},${r.room ?? ''},${r.attendance ?? ''},"${(r.remark ?? '').replace(/"/g, '""')}"`
      )
    ].join('\n');
    
    fs.writeFileSync(path.join(backupPath, 'schedules.csv'), schedulesCsv);
    console.log(`   ✅ Backed up ${schedules.rows.length} schedules\n`);

    // ═══════════════════════════════════════════════════════════════
    // Backup 4: Teacher Courses Table
    // ═══════════════════════════════════════════════════════════════
    console.log('📦  Backing up teacher_courses table...');
    const teacherCourses = await client.query(`
      SELECT id, "teacherId", "courseId"
      FROM teacher_courses 
      ORDER BY id
    `);
    
    const teacherCoursesCsv = [
      'id,teacherId,courseId',
      ...teacherCourses.rows.map((r: any) => 
        `${r.id},${r.teacherId ?? ''},${r.courseId ?? ''}`
      )
    ].join('\n');
    
    fs.writeFileSync(path.join(backupPath, 'teacher_courses.csv'), teacherCoursesCsv);
    console.log(`   ✅ Backed up ${teacherCourses.rows.length} teacher course assignments\n`);

    // ═══════════════════════════════════════════════════════════════
    // Create Metadata File
    // ═══════════════════════════════════════════════════════════════
    const metadata = {
      timestamp: new Date().toISOString(),
      database: process.env.DATABASE_URL?.split('@')[1]?.split('/')[1] || 'unknown',
      tables: {
        sessions: sessions.rows.length,
        courses: courses.rows.length,
        schedules: schedules.rows.length,
        teacher_courses: teacherCourses.rows.length,
      },
      purpose: 'Backup before running db-fix.ts',
      notes: 'Use restore-from-backup.ts to restore this backup if needed'
    };

    fs.writeFileSync(
      path.join(backupPath, 'backup-metadata.json'), 
      JSON.stringify(metadata, null, 2)
    );

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅  BACKUP COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`📁  Backup location: ${backupPath}`);
    console.log(`📊  Total records backed up: ${
      sessions.rows.length + 
      courses.rows.length + 
      schedules.rows.length + 
      teacherCourses.rows.length
    }`);
    console.log('\n📋  Backed up tables:');
    console.log(`   - sessions: ${sessions.rows.length} records`);
    console.log(`   - courses: ${courses.rows.length} records`);
    console.log(`   - schedules: ${schedules.rows.length} records`);
    console.log(`   - teacher_courses: ${teacherCourses.rows.length} records`);
    console.log('\n✅  You can now safely run db-fix.ts');
    console.log('💡  To restore this backup: npx ts-node scripts/restore-from-backup.ts\n');

  } catch (err) {
    console.error('\n❌  ERROR during backup:');
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
