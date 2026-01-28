/**
 * Multi-Year Data Migration Script
 * 
 * Imports data from all year folders + clean 2024/2025 data into database
 * 
 * Expected structure:
 *   kdl-lms/
 *     ocr-output/
 *       2019-2020/students.csv
 *       2021-2022/students.csv
 *     students_2024.csv  (clean data)
 *     students_2025.csv  (clean data)
 *     courses_master.csv (all courses)
 * 
 * Usage:
 *   npx ts-node scripts/migrate-all-years.ts --dry-run
 *   npx ts-node scripts/migrate-all-years.ts
 *   npx ts-node scripts/migrate-all-years.ts --cleanup (wipes DB first)
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';

// Configuration
const ROOT_DIR = path.join(__dirname, '../..');
const OCR_OUTPUT_DIR = path.join(ROOT_DIR, 'ocr-output');

// Clean data files
const CLEAN_FILES = {
  students2024: path.join(ROOT_DIR, 'students_2024.csv'),
  students2025: path.join(ROOT_DIR, 'students_2025.csv'),
  sessions2024: path.join(ROOT_DIR, 'sessions_2024.csv'),
  sessions2025: path.join(ROOT_DIR, 'sessions_2025.csv'),
  schedules2025: path.join(ROOT_DIR, 'schedules_2025.csv'),
  teachers: path.join(ROOT_DIR, 'teachers.csv'),
  classOptions: path.join(ROOT_DIR, 'class_options.csv'),
  courses: path.join(ROOT_DIR, 'courses_master.csv'), // Use master courses
};

// CSV Parser
function parseCSV(filePath: string): Record<string, string>[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) return [];

  let headerLine = lines[0].replace(/^\uFEFF/, '').replace(/˜˜/g, 'studentId');
  const headers = parseCSVLine(headerLine);
  
  const records: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      const cleanHeader = header.trim();
      record[cleanHeader] = values[index]?.trim() || '';
    });
    
    records.push(record);
  }
  
  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

// Get all OCR year folders
function getOCRYearFolders(): string[] {
  if (!fs.existsSync(OCR_OUTPUT_DIR)) return [];
  
  const entries = fs.readdirSync(OCR_OUTPUT_DIR, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory() && /^\d{4}(-\d{4})?$/.test(entry.name))
    .map(entry => entry.name)
    .sort();
}

// Merge students from all sources
function mergeAllStudents(): any[] {
  const studentMap = new Map<string, any>();
  
  // 1. Load OCR data from all year folders
  const yearFolders = getOCRYearFolders();
  console.log(`\n📁 Found ${yearFolders.length} OCR year folders: ${yearFolders.join(', ')}`);
  
  for (const yearFolder of yearFolders) {
    const studentsFile = path.join(OCR_OUTPUT_DIR, yearFolder, 'students.csv');
    if (!fs.existsSync(studentsFile)) continue;
    
    const records = parseCSV(studentsFile);
    console.log(`   ${yearFolder}: ${records.length} students`);
    
    for (const record of records) {
      const studentId = record.studentId?.trim();
      if (!studentId) continue;
      
      studentMap.set(studentId, {
        studentId,
        name: record.name || '',
        nickname: record.nickname || '',
        nationalId: record.nationalId || '',
        dob: record.dob || '',
        gender: record.gender || '',
        school: record.school || '',
        allergic: record.allergic ? [record.allergic] : [],
        doNotEat: record.doNotEat ? [record.doNotEat] : [],
        adConcent: record.adConcent?.toLowerCase() === 'true',
        phone: record.phone || '',
        profilePicture: '',
        profileKey: null,
        source: `OCR-${yearFolder}`
      });
    }
  }
  
  // 2. Load clean 2024 data (overrides OCR if exists)
  if (fs.existsSync(CLEAN_FILES.students2024)) {
    const records = parseCSV(CLEAN_FILES.students2024);
    console.log(`   2024 (clean): ${records.length} students`);
    
    for (const record of records) {
      const studentId = record.studentId?.trim();
      if (!studentId) continue;
      
      studentMap.set(studentId, {
        studentId,
        name: record.name || '',
        nickname: record.nickname || '',
        nationalId: record.nationalId || '',
        dob: record.dob || '',
        gender: record.gender || '',
        school: record.school || '',
        allergic: record.allergic ? [record.allergic] : [],
        doNotEat: record.doNotEat ? [record.doNotEat] : [],
        adConcent: record.adContent?.toLowerCase() === 'true',
        phone: record.phone || '',
        profilePicture: '',
        profileKey: null,
        source: 'Clean-2024'
      });
    }
  }
  
  // 3. Load clean 2025 data (highest priority)
  if (fs.existsSync(CLEAN_FILES.students2025)) {
    const records = parseCSV(CLEAN_FILES.students2025);
    console.log(`   2025 (clean): ${records.length} students`);
    
    for (const record of records) {
      const studentId = record.studentId?.trim();
      if (!studentId) continue;
      
      studentMap.set(studentId, {
        studentId,
        name: record.name || '',
        nickname: record.nickname || '',
        nationalId: record.nationalId || '',
        dob: record.dob || '',
        gender: record.gender || '',
        school: record.school || '',
        allergic: record.allergic ? [record.allergic] : [],
        doNotEat: record.doNotEat ? [record.doNotEat] : [],
        adConcent: record.adContent?.toLowerCase() === 'true',
        phone: record.phone || '',
        profilePicture: '',
        profileKey: null,
        source: 'Clean-2025'
      });
    }
  }
  
  console.log(`\n✅ Total unique students: ${studentMap.size}`);
  return Array.from(studentMap.values());
}

// Merge parents from OCR output (up to 2024, excluding 2025)
function mergeAllParents(): any[] {
  const parentMap = new Map<string, any>();
  
  // Load OCR data from all year folders (excluding 2025)
  const yearFolders = getOCRYearFolders();
  console.log(`\n📁 Loading parents from OCR folders (excluding 2025)...`);
  
  for (const yearFolder of yearFolders) {
    // Skip 2025 and later years
    if (yearFolder.startsWith('2025') || parseInt(yearFolder.substring(0, 4)) >= 2025) {
      continue;
    }
    
    const parentsFile = path.join(OCR_OUTPUT_DIR, yearFolder, 'parents.csv');
    if (!fs.existsSync(parentsFile)) continue;
    
    const records = parseCSV(parentsFile);
    console.log(`   ${yearFolder}: ${records.length} parents`);
    
    for (const record of records) {
      const name = record.name?.trim();
      if (!name) continue;
      
      // Use name + contactNo as key for deduplication (more accurate than name alone)
      const key = `${name.toLowerCase()}_${(record.contactNo || '').trim()}`;
      
      // Only add if not already exists (first occurrence wins)
      if (!parentMap.has(key)) {
        parentMap.set(key, {
          name: name,
          email: record.email || '',
          contactNo: record.contactNo || '',
          lineId: record.lineId || '',
          address: record.address || '',
          profilePicture: record.profilePicture || '',
          profileKey: record.profileKey || null,
          source: `OCR-${yearFolder}`
        });
      }
    }
  }
  
  console.log(`\n✅ Total unique parents: ${parentMap.size}`);
  return Array.from(parentMap.values());
}

// Merge sessions from all sources
function mergeAllSessions(): any[] {
  const sessions: any[] = [];
  let sessionId = 1;
  
  // 1. OCR sessions
  const yearFolders = getOCRYearFolders();
  for (const yearFolder of yearFolders) {
    const sessionsFile = path.join(OCR_OUTPUT_DIR, yearFolder, 'sessions.csv');
    if (!fs.existsSync(sessionsFile)) continue;
    
    const records = parseCSV(sessionsFile);
    console.log(`   ${yearFolder}: ${records.length} sessions`);
    
    for (const record of records) {
      sessions.push({
        id: sessionId++,
        studentId: record.studentId?.trim() || '',
        courseId: parseInt(record.courseId) || 0,
        classOptionId: parseInt(record.classOptionId) || 1,
        classCancel: parseInt(record.classCancel) || 0,
        payment: record.payment || 'Pending',
        status: record.status || 'wip',
        teacherId: record.teacherId ? parseInt(record.teacherId) : null,
        invoiceDone: false,
        packageGroupId: null,
        comment: null,
        source: `OCR-${yearFolder}`
      });
    }
  }
  
  // 2. Clean 2024/2025 sessions
  if (fs.existsSync(CLEAN_FILES.sessions2024)) {
    const records = parseCSV(CLEAN_FILES.sessions2024);
    console.log(`   2024 (clean): ${records.length} sessions`);
    
    for (const record of records) {
      sessions.push({
        id: sessionId++,
        studentId: record.studentId || record[''] || Object.values(record)[0] || '',
        courseId: parseInt(record.courseId) || 0,
        classOptionId: parseInt(record.classOptionId) || 1,
        classCancel: parseInt(record.classCancel) || 0,
        payment: record.payment || 'Paid',
        status: record.status || 'completed',
        teacherId: record.teacherId && record.teacherId !== 'NULL' ? parseInt(record.teacherId) : null,
        invoiceDone: record.InvoiceDone?.toUpperCase() === 'TRUE',
        packageGroupId: null,
        comment: null,
        source: 'Clean-2024'
      });
    }
  }
  
  if (fs.existsSync(CLEAN_FILES.sessions2025)) {
    const records = parseCSV(CLEAN_FILES.sessions2025);
    console.log(`   2025 (clean): ${records.length} sessions`);
    
    for (const record of records) {
      const sid = parseInt(record.sessionId);
      sessions.push({
        id: sid || sessionId++,
        studentId: record.studentId?.trim() || '',
        courseId: parseInt(record.courseId) || 0,
        classOptionId: parseInt(record.classOptionId) || 1,
        classCancel: parseInt(record.classCancel) || 0,
        payment: record.payment || 'Pending',
        status: record.status || 'active',
        teacherId: record.teacherId ? parseInt(record.teacherId) : null,
        invoiceDone: record.InvoiceDone?.toLowerCase() === 'true',
        packageGroupId: record.packageGroupId ? parseInt(record.packageGroupId) : null,
        comment: null,
        source: 'Clean-2025'
      });
    }
  }
  
  console.log(`\n✅ Total sessions: ${sessions.length}`);
  return sessions;
}

// Transform functions (simplified from migrate-csv-data.ts)
function transformCourses(records: Record<string, string>[]): any[] {
  return records
    .filter(r => r.id)
    .map(record => ({
      id: parseInt(record.id, 10),
      title: record.title || '',
      description: record.description || '',
      ageRange: record.ageRange || '',
      medium: record.medium || '',
    }));
}

function transformTeachers(records: Record<string, string>[]): any[] {
  return records
    .filter(r => r.id && r.name)
    .map(record => ({
      id: parseInt(record.id, 10),
      name: record.name || '',
      email: record.email || '',
      password: record.password || '',
      contactNo: record.contactNo || '',
      lineId: record.lineId || '',
      address: record.address || '',
      profilePicture: '',
      profileKey: null,
    }));
}

function transformClassOptions(records: Record<string, string>[]): any[] {
  return records
    .filter(r => r.id)
    .map(record => ({
      id: parseInt(record.id, 10),
      classMode: record.classMode || '',
      classLimit: parseInt(record.classLimit, 10) || 0,
      tuitionFee: parseFloat(record.tuitionFee) || 0,
      effectiveStartDate: new Date('2024-01-01'),
      effectiveEndDate: null,
    }));
}

// Database insertion (reusing from migrate-csv-data.ts)
async function insertStudents(dataSource: DataSource, students: any[]): Promise<Map<string, number>> {
  console.log(`\n🎓 Inserting ${students.length} students...`);
  
  const studentIdMap = new Map<string, number>();
  let inserted = 0;
  let updated = 0;
  
  for (const student of students) {
    const result = await dataSource.query(
      `INSERT INTO students ("studentId", name, nickname, "nationalId", dob, gender, school, allergic, "doNotEat", "adConcent", phone, "profilePicture", "profileKey")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT ("studentId") DO UPDATE SET
         name = EXCLUDED.name,
         nickname = EXCLUDED.nickname,
         dob = EXCLUDED.dob,
         gender = EXCLUDED.gender,
         school = EXCLUDED.school,
         phone = EXCLUDED.phone
       RETURNING id`,
      [
        student.studentId,
        student.name,
        student.nickname,
        student.nationalId || null,
        student.dob,
        student.gender,
        student.school,
        student.allergic,
        student.doNotEat,
        student.adConcent,
        student.phone,
        student.profilePicture,
        student.profileKey,
      ]
    );
    
    const dbId = result[0].id;
    studentIdMap.set(student.studentId, dbId);
    inserted++;
  }
  
  console.log(`   ✅ Processed ${inserted} students`);
  return studentIdMap;
}

async function insertSessions(
  dataSource: DataSource, 
  sessions: any[], 
  studentIdMap: Map<string, number>,
  validCourseIds: Set<number>,
  validClassOptionIds: Set<number>
) {
  console.log(`\n📋 Inserting ${sessions.length} sessions...`);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const session of sessions) {
    const dbStudentId = studentIdMap.get(session.studentId);
    if (!dbStudentId) {
      console.log(`   ⚠️  Session ${session.id}: Student ${session.studentId} not found`);
      skipped++;
      continue;
    }
    
    if (!validCourseIds.has(session.courseId)) {
      console.log(`   ⚠️  Session ${session.id}: Course ${session.courseId} not found`);
      skipped++;
      continue;
    }
    
    let classOptionId = session.classOptionId;
    if (!validClassOptionIds.has(classOptionId)) {
      classOptionId = 1;
    }
    
    try {
      await dataSource.query(
        `INSERT INTO sessions (id, "studentId", "courseId", "classOptionId", "classCancel", payment, status, "teacherId", "invoiceDone", "packageGroupId", comment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           "studentId" = EXCLUDED."studentId",
           "courseId" = EXCLUDED."courseId",
           payment = EXCLUDED.payment,
           status = EXCLUDED.status`,
        [
          session.id,
          dbStudentId,
          session.courseId,
          classOptionId,
          session.classCancel,
          session.payment,
          session.status,
          session.teacherId,
          session.invoiceDone,
          session.packageGroupId,
          session.comment,
        ]
      );
      inserted++;
    } catch (error: any) {
      console.log(`   ⚠️  Session ${session.id} failed: ${error.message}`);
      skipped++;
    }
  }
  
  if (sessions.length > 0) {
    const maxId = Math.max(...sessions.map(s => s.id));
    await dataSource.query(`SELECT setval('sessions_id_seq', $1, true)`, [maxId]);
  }
  
  console.log(`   ✅ Inserted ${inserted} sessions, skipped ${skipped}`);
}

async function insertParents(dataSource: DataSource, parents: any[]): Promise<Map<string, number>> {
  console.log(`\n👨‍👩‍👧 Inserting ${parents.length} parents...`);
  
  const parentIdMap = new Map<string, number>();
  let inserted = 0;
  let skipped = 0;
  
  for (const parent of parents) {
    try {
      // Use name + contactNo as key for matching
      const key = `${parent.name.toLowerCase()}_${(parent.contactNo || '').trim()}`;
      
      // Check if parent already exists
      const existing = await dataSource.query(
        `SELECT id FROM parents WHERE LOWER(name) = LOWER($1) AND "contactNo" = $2 LIMIT 1`,
        [parent.name, parent.contactNo || '']
      );
      
      if (existing.length > 0) {
        // Parent already exists, use existing ID
        parentIdMap.set(key, existing[0].id);
        skipped++;
        continue;
      }
      
      // Insert new parent
      const result = await dataSource.query(
        `INSERT INTO parents (name, email, "contactNo", "lineId", address, "profilePicture", "profileKey")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          parent.name,
          parent.email || '',
          parent.contactNo || '',
          parent.lineId || '',
          parent.address || '',
          parent.profilePicture || null,
          parent.profileKey || null,
        ]
      );
      
      if (result.length > 0) {
        const dbId = result[0].id;
        parentIdMap.set(key, dbId);
        inserted++;
      }
    } catch (error: any) {
      console.log(`   ⚠️  Parent ${parent.name} failed: ${error.message}`);
      skipped++;
    }
  }
  
  console.log(`   ✅ Inserted ${inserted} parents, skipped ${skipped} duplicates`);
  return parentIdMap;
}

// Transform schedules (2025 only)
interface Schedule {
  sessionId: number;
  studentId: number; // DB id
  courseId: number;
  teacherId: number | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  room: string;
  attendance: string;
  remark: string;
  warning: string;
  feedback: string;
  verifyFb: boolean;
}

function transformSchedules(
  records: Record<string, string>[],
  studentIdMap: Map<string, number>,
  validSessionIds: Set<number>,
  validCourseIds: Set<number>
): Schedule[] {
  const schedules: Schedule[] = [];
  
  for (const record of records) {
    const sessionId = parseInt(record.sessionId, 10);
    const formattedStudentId = record.studentId?.trim();
    const courseId = parseInt(record.courseId, 10);
    
    if (!sessionId || !formattedStudentId) continue;
    
    const dbStudentId = studentIdMap.get(formattedStudentId);
    if (!dbStudentId) {
      console.log(`⚠️  Schedule: Student ${formattedStudentId} not found, skipping`);
      continue;
    }
    
    if (!validSessionIds.has(sessionId)) {
      console.log(`⚠️  Schedule: Session ${sessionId} not found, skipping`);
      continue;
    }
    
    if (!validCourseIds.has(courseId)) {
      console.log(`⚠️  Schedule: Course ${courseId} not found, skipping`);
      continue;
    }
    
    // Map attendance values
    let attendance = record.attendance?.trim() || 'Pending';
    if (attendance === 'TBD') attendance = 'Pending';
    
    schedules.push({
      sessionId,
      studentId: dbStudentId,
      courseId,
      teacherId: record.teacherId ? parseInt(record.teacherId, 10) : null,
      date: record.date || null,
      startTime: record.startTime || null,
      endTime: record.endTime || null,
      room: record.room || '',
      attendance,
      remark: record.remark || '',
      warning: '',
      feedback: '',
      verifyFb: false,
    });
  }
  
  return schedules;
}

async function insertSchedules(dataSource: DataSource, schedules: Schedule[]) {
  console.log(`\n📅 Inserting ${schedules.length} schedules...`);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const schedule of schedules) {
    try {
      await dataSource.query(
        `INSERT INTO schedules ("sessionId", "studentId", "courseId", "teacherId", date, "startTime", "endTime", room, attendance, remark, warning, feedback, "verifyFb")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT DO NOTHING`,
        [
          schedule.sessionId,
          schedule.studentId,
          schedule.courseId,
          schedule.teacherId,
          schedule.date,
          schedule.startTime,
          schedule.endTime,
          schedule.room,
          schedule.attendance,
          schedule.remark,
          schedule.warning,
          schedule.feedback,
          schedule.verifyFb,
        ]
      );
      inserted++;
    } catch (error: any) {
      console.log(`   ⚠️  Schedule for session ${schedule.sessionId} failed: ${error.message}`);
      skipped++;
    }
  }
  
  console.log(`   ✅ Inserted ${inserted} schedules, skipped ${skipped}`);
}

// Extract and insert teacher-course relationships from schedule data
async function insertTeacherCourses(dataSource: DataSource, schedulesRaw: Record<string, string>[]) {
  console.log(`\n🔗 Extracting teacher-course relationships from schedules...`);
  
  // Extract unique teacherId + courseId pairs
  const pairs = new Set<string>();
  
  for (const record of schedulesRaw) {
    const teacherId = parseInt(record.teacherId, 10);
    const courseId = parseInt(record.courseId, 10);
    
    if (teacherId && courseId) {
      pairs.add(`${teacherId}-${courseId}`);
    }
  }
  
  console.log(`   Found ${pairs.size} unique teacher-course pairs`);
  
  let inserted = 0;
  for (const pair of pairs) {
    const [teacherId, courseId] = pair.split('-').map(Number);
    
    try {
      await dataSource.query(
        `INSERT INTO teacher_courses ("teacherId", "courseId")
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [teacherId, courseId]
      );
      inserted++;
    } catch (error: any) {
      console.log(`   ⚠️  Teacher-course pair ${teacherId}-${courseId} failed: ${error.message}`);
    }
  }
  
  console.log(`   ✅ Inserted ${inserted} teacher-course relationships`);
}

// Link parents to students based on sourceImage (from OCR CSVs)
async function linkParentsToStudents(
  dataSource: DataSource,
  studentIdMap: Map<string, number>,
  parentIdMap: Map<string, number>
) {
  console.log(`\n🔗 Linking parents to students from OCR data...`);
  
  let linked = 0;
  let skipped = 0;
  
  // Load students and parents from OCR output folders (up to 2024)
  const yearFolders = getOCRYearFolders();
  
  for (const yearFolder of yearFolders) {
    // Skip 2025 and later
    if (yearFolder.startsWith('2025') || parseInt(yearFolder.substring(0, 4)) >= 2025) {
      continue;
    }
    
    const studentsFile = path.join(OCR_OUTPUT_DIR, yearFolder, 'students.csv');
    const parentsFile = path.join(OCR_OUTPUT_DIR, yearFolder, 'parents.csv');
    
    if (!fs.existsSync(studentsFile) || !fs.existsSync(parentsFile)) continue;
    
    const students = parseCSV(studentsFile);
    const parents = parseCSV(parentsFile);
    
    // Create maps by sourceImage
    const studentsByImage = new Map<string, any>();
    const parentsByImage = new Map<string, any>();
    
    for (const student of students) {
      const sourceImage = student.sourceImage?.trim();
      const studentId = student.studentId?.trim();
      if (sourceImage && studentId) {
        studentsByImage.set(sourceImage, student);
      }
    }
    
    for (const parent of parents) {
      const sourceImage = parent.sourceImage?.trim();
      const parentName = parent.name?.trim();
      const contactNo = parent.contactNo?.trim();
      if (sourceImage && parentName) {
        const key = `${parentName.toLowerCase()}_${contactNo}`;
        parentsByImage.set(sourceImage, { parent, key });
      }
    }
    
    // Match by sourceImage
    for (const [sourceImage, student] of studentsByImage.entries()) {
      const parentData = parentsByImage.get(sourceImage);
      if (!parentData) continue;
      
      const studentId = student.studentId?.trim();
      const dbStudentId = studentIdMap.get(studentId);
      const dbParentId = parentIdMap.get(parentData.key);
      
      if (!dbStudentId || !dbParentId) {
        skipped++;
        continue;
      }
      
      try {
        // Check if link already exists
        const existing = await dataSource.query(
          `SELECT id FROM parent_students WHERE "parentId" = $1 AND "studentId" = $2`,
          [dbParentId, dbStudentId]
        );
        
        if (existing.length > 0) {
          skipped++;
          continue;
        }
        
        // Check if student already has a primary parent
        const existingPrimary = await dataSource.query(
          `SELECT id FROM parent_students WHERE "studentId" = $1 AND "isPrimary" = true`,
          [dbStudentId]
        );
        
        const isPrimary = existingPrimary.length === 0; // First parent for this student is primary
        
        // Create parent-student link
        await dataSource.query(
          `INSERT INTO parent_students ("parentId", "studentId", "isPrimary")
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [dbParentId, dbStudentId, isPrimary]
        );
        linked++;
      } catch (error: any) {
        console.log(`   ⚠️  Failed to link parent ${parentData.parent.name} to student ${studentId}: ${error.message}`);
        skipped++;
      }
    }
  }
  
  console.log(`   ✅ Linked ${linked} parent-student relationships, skipped ${skipped}`);
}

// Simplified cleanup (from migrate-csv-data.ts)
async function cleanupDatabase(dataSource: DataSource) {
  console.log('\n🧹 Cleaning up database...');
  console.log('   ℹ️  Preserving: users, rooms, discounts\n');
  
  const queryRunner = dataSource.createQueryRunner();
  
  const tables = [
    'receipts', 'invoice_items', 'invoices', 'feedbacks', 'teacher_absences',
    'course_plus', 'schedules', 'sessions', 'parent_students', 'parents',
    'students', 'teacher_courses', 'teachers', 'courses', 'class_options',
  ];
  
  for (const table of tables) {
    try {
      await queryRunner.query(`TRUNCATE TABLE ${table} CASCADE`);
      console.log(`   ✅ Truncated ${table}`);
    } catch (error: any) {
      try {
        await queryRunner.query(`DELETE FROM ${table}`);
        console.log(`   ✅ Deleted from ${table}`);
      } catch (deleteError: any) {
        console.log(`   ⚠️  Could not clear ${table}: ${deleteError.message}`);
      }
    }
  }
  
  await queryRunner.release();
}

// Reuse insert functions from migrate-csv-data.ts
async function insertCourses(dataSource: DataSource, courses: any[]) {
  console.log(`\n📚 Inserting ${courses.length} courses...`);
  
  for (const course of courses) {
    await dataSource.query(
      `INSERT INTO courses (id, title, description, "ageRange", medium)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description`,
      [course.id, course.title, course.description, course.ageRange, course.medium]
    );
  }
  
  const maxId = Math.max(...courses.map(c => c.id));
  await dataSource.query(`SELECT setval('courses_id_seq', $1, true)`, [maxId]);
  
  console.log(`   ✅ Inserted courses`);
}

async function insertTeachers(dataSource: DataSource, teachers: any[]) {
  console.log(`\n👨‍🏫 Inserting ${teachers.length} teachers...`);
  
  const SALT_ROUNDS = 10;
  
  for (const teacher of teachers) {
    const hashedPassword = teacher.password 
      ? await bcrypt.hash(teacher.password, SALT_ROUNDS)
      : await bcrypt.hash('kdl123456', SALT_ROUNDS);
    
    await dataSource.query(
      `INSERT INTO teachers (id, name, email, password, "contactNo", "lineId", address, "profilePicture", "profileKey")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email`,
      [teacher.id, teacher.name, teacher.email, hashedPassword, teacher.contactNo, teacher.lineId, teacher.address, teacher.profilePicture, teacher.profileKey]
    );
  }
  
  const maxId = Math.max(...teachers.map(t => t.id));
  await dataSource.query(`SELECT setval('teachers_id_seq', $1, true)`, [maxId]);
  
  console.log(`   ✅ Inserted teachers`);
}

async function insertClassOptions(dataSource: DataSource, classOptions: any[]) {
  console.log(`\n📦 Inserting ${classOptions.length} class options...`);
  
  for (const option of classOptions) {
    await dataSource.query(
      `INSERT INTO class_options (id, "classMode", "classLimit", "tuitionFee", "effectiveStartDate", "effectiveEndDate")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         "classMode" = EXCLUDED."classMode",
         "tuitionFee" = EXCLUDED."tuitionFee"`,
      [option.id, option.classMode, option.classLimit, option.tuitionFee, option.effectiveStartDate, option.effectiveEndDate]
    );
  }
  
  const maxId = Math.max(...classOptions.map(o => o.id));
  await dataSource.query(`SELECT setval('class_options_id_seq', $1, true)`, [maxId]);
  
  console.log(`   ✅ Inserted class options`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const doCleanup = args.includes('--cleanup');
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Multi-Year Data Migration Script                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  if (isDryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  // Check files
  console.log('\n📁 Checking files...');
  for (const [name, filePath] of Object.entries(CLEAN_FILES)) {
    const exists = fs.existsSync(filePath);
    console.log(`   ${exists ? '✅' : '⚠️ '} ${name}: ${path.basename(filePath)}`);
  }
  
  // Merge data
  console.log('\n🔄 Merging data from all sources...');
  const students = mergeAllStudents();
  const parents = mergeAllParents();
  const sessions = mergeAllSessions();
  
  const coursesRaw = parseCSV(CLEAN_FILES.courses);
  const teachersRaw = parseCSV(CLEAN_FILES.teachers);
  const classOptionsRaw = parseCSV(CLEAN_FILES.classOptions);
  const schedulesRaw = parseCSV(CLEAN_FILES.schedules2025);
  
  const courses = transformCourses(coursesRaw);
  const teachers = transformTeachers(teachersRaw);
  const classOptions = transformClassOptions(classOptionsRaw);
  
  console.log(`\n📊 Summary:`);
  console.log(`   Students: ${students.length}`);
  console.log(`   Parents: ${parents.length}`);
  console.log(`   Courses: ${courses.length}`);
  console.log(`   Teachers: ${teachers.length}`);
  console.log(`   Class Options: ${classOptions.length}`);
  console.log(`   Sessions: ${sessions.length}`);
  console.log(`   Schedules (2025): ${schedulesRaw.length}`);
  
  if (isDryRun) {
    console.log('\n✅ Dry run complete. Run without --dry-run to execute migration.');
    return;
  }
  
  // Connect to DB
  console.log('\n🔌 Connecting to database...');
  
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
    logging: false,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    await dataSource.initialize();
    console.log('   ✅ Connected');
    
    if (doCleanup) {
      await cleanupDatabase(dataSource);
    }
    
    await insertClassOptions(dataSource, classOptions);
    await insertCourses(dataSource, courses);
    await insertTeachers(dataSource, teachers);
    
    const studentIdMap = await insertStudents(dataSource, students);
    const parentIdMap = await insertParents(dataSource, parents);
    
    const validCourseIds = new Set(courses.map(c => c.id));
    const validClassOptionIds = new Set(classOptions.map(o => o.id));
    const validSessionIds = new Set(sessions.map(s => s.id));
    
    await insertSessions(dataSource, sessions, studentIdMap, validCourseIds, validClassOptionIds);
    
    // Insert schedules (2025 only)
    if (schedulesRaw.length > 0) {
      const schedules = transformSchedules(schedulesRaw, studentIdMap, validSessionIds, validCourseIds);
      await insertSchedules(dataSource, schedules);
      
      // Extract and insert teacher-course relationships from schedules
      await insertTeacherCourses(dataSource, schedulesRaw);
    }
    
    // Link parents to students from OCR data
    await linkParentsToStudents(dataSource, studentIdMap, parentIdMap);
    
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                Migration Complete!                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    
    const counts = await dataSource.query(`
      SELECT 'students' as table_name, COUNT(*)::int as count FROM students
      UNION ALL SELECT 'parents', COUNT(*)::int FROM parents
      UNION ALL SELECT 'courses', COUNT(*)::int FROM courses
      UNION ALL SELECT 'teachers', COUNT(*)::int FROM teachers
      UNION ALL SELECT 'sessions', COUNT(*)::int FROM sessions
      UNION ALL SELECT 'schedules', COUNT(*)::int FROM schedules
      UNION ALL SELECT 'parent_students', COUNT(*)::int FROM parent_students
      UNION ALL SELECT 'teacher_courses', COUNT(*)::int FROM teacher_courses
    `);
    
    console.log('\n📊 Final counts:');
    for (const row of counts) {
      console.log(`   ${row.table_name}: ${row.count}`);
    }
    
    await dataSource.destroy();
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
