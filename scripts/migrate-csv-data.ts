/**
 * CSV Data Migration Script
 * 
 * Migrates data from CSV files to the database:
 * - students (2024 + 2025, merged & deduplicated)
 * - courses (2024 version - complete)
 * - teachers
 * - class_options
 * - sessions (2024 + 2025, merged)
 * - schedules (2025)
 * 
 * Usage: npx ts-node scripts/migrate-csv-data.ts
 * 
 * Options:
 *   --dry-run    Preview what will be imported without making changes
 *   --cleanup    Wipe existing data before import
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CSV_DIR = path.join(__dirname, '..', '..'); // Root of kdl-lms folder

const CSV_FILES = {
  students2024: path.join(CSV_DIR, 'students-2024.csv'),
  students2025: path.join(CSV_DIR, 'students_2025.csv'),
  courses: path.join(CSV_DIR, 'courses_2024.csv'),
  sessions2024: path.join(CSV_DIR, 'sessions_2024.csv'),
  sessions2025: path.join(CSV_DIR, 'sessions_2025.csv'),
  schedules: path.join(CSV_DIR, 'schedules_2025.csv'),
  teachers: path.join(CSV_DIR, 'teachers.csv'),
  classOptions: path.join(CSV_DIR, 'class_options.csv'),
};

// =============================================================================
// CSV PARSER
// =============================================================================

function parseCSV(filePath: string): Record<string, string>[] {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) return [];

  // Parse header - handle BOM and weird characters
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

// =============================================================================
// DATA TRANSFORMERS
// =============================================================================

interface Student {
  studentId: string;
  name: string;
  nickname: string;
  nationalId: string;
  dob: string;
  gender: string;
  school: string;
  allergic: string[];
  doNotEat: string[];
  adConcent: boolean;
  phone: string;
  profilePicture: string;
  profileKey: string | null;
  dbId?: number; // Populated after insert
}

interface Course {
  id: number;
  title: string;
  description: string;
  ageRange: string;
  medium: string;
}

interface Teacher {
  id: number;
  name: string;
  email: string;
  password: string;
  contactNo: string;
  lineId: string;
  address: string;
  profilePicture: string;
  profileKey: string | null;
}

interface ClassOption {
  id: number;
  classMode: string;
  classLimit: number;
  tuitionFee: number;
  effectiveStartDate: Date;
  effectiveEndDate: Date | null;
}

interface Session {
  id: number;
  studentId: number; // This will be the DB id, not the formatted studentId
  courseId: number;
  classOptionId: number;
  classCancel: number;
  payment: string;
  status: string;
  teacherId: number | null;
  invoiceDone: boolean;
  packageGroupId: number | null;
  comment: string | null;
}

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

interface InvoiceData {
  sessionId: number;
  documentId: string;
  date: Date;
  paymentMethod: string;
  totalAmount: number;
  studentId: number;
  studentName: string;
  courseName: string;
  classOptionName: string;
  sessionGroups: Array<{
    sessionId: string;
    transactionType: 'course' | 'courseplus' | 'package';
    actualId: string;
  }>;
}

function transformStudents(records2024: Record<string, string>[], records2025: Record<string, string>[]): Student[] {
  const studentMap = new Map<string, Student>();
  
  // Process 2024 students
  for (const record of records2024) {
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
    });
  }
  
  // Process 2025 students (will override 2024 if duplicate)
  for (const record of records2025) {
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
    });
  }
  
  return Array.from(studentMap.values());
}

function transformCourses(records: Record<string, string>[]): Course[] {
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

function transformTeachers(records: Record<string, string>[]): Teacher[] {
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

function transformClassOptions(records: Record<string, string>[]): ClassOption[] {
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

function transformSessions2025(
  records: Record<string, string>[],
  studentIdMap: Map<string, number>,
  validCourseIds: Set<number>,
  validClassOptionIds: Set<number>
): Session[] {
  const sessions: Session[] = [];
  
  for (const record of records) {
    const sessionId = parseInt(record.sessionId, 10);
    const formattedStudentId = record.studentId?.trim();
    const courseId = parseInt(record.courseId, 10);
    
    if (!sessionId || !formattedStudentId) continue;
    
    const dbStudentId = studentIdMap.get(formattedStudentId);
    if (!dbStudentId) {
      console.log(`⚠️  Session ${sessionId}: Student ${formattedStudentId} not found, skipping`);
      continue;
    }
    
    if (!validCourseIds.has(courseId)) {
      console.log(`⚠️  Session ${sessionId}: Course ${courseId} not found, skipping`);
      continue;
    }
    
    let classOptionId = parseInt(record.classOptionId, 10) || 1;
    if (!validClassOptionIds.has(classOptionId)) {
      classOptionId = 1; // Default to "12 times fixed"
    }
    
    sessions.push({
      id: sessionId,
      studentId: dbStudentId,
      courseId,
      classOptionId,
      classCancel: parseInt(record.classCancel, 10) || 0,
      payment: record.payment || 'Pending',
      status: record.status || 'active',
      teacherId: record.teacherId ? parseInt(record.teacherId, 10) : null,
      invoiceDone: record.InvoiceDone?.toLowerCase() === 'true',
      packageGroupId: record.packageGroupId ? parseInt(record.packageGroupId, 10) : null,
      comment: null,
    });
  }
  
  return sessions;
}

function transformSessions2024(
  records: Record<string, string>[],
  studentIdMap: Map<string, number>,
  validCourseIds: Set<number>,
  validClassOptionIds: Set<number>,
  startingId: number
): Session[] {
  const sessions: Session[] = [];
  let currentId = startingId;
  
  for (const record of records) {
    // 2024 CSV has studentId in first column (unnamed or empty header)
    const formattedStudentId = record[''] || record.studentId || Object.values(record)[0];
    const courseId = parseInt(record.courseId, 10);
    
    if (!formattedStudentId?.trim() || !courseId) continue;
    
    const dbStudentId = studentIdMap.get(formattedStudentId.trim());
    if (!dbStudentId) {
      console.log(`⚠️  Session 2024: Student ${formattedStudentId} not found, skipping`);
      continue;
    }
    
    if (!validCourseIds.has(courseId)) {
      console.log(`⚠️  Session 2024: Course ${courseId} not found, skipping`);
      continue;
    }
    
    let classOptionId = parseInt(record.classOptionId, 10) || 1;
    if (!validClassOptionIds.has(classOptionId)) {
      classOptionId = 1;
    }
    
    sessions.push({
      id: currentId++,
      studentId: dbStudentId,
      courseId,
      classOptionId,
      classCancel: parseInt(record.classCancel, 10) || 0,
      payment: record.payment || 'Paid',
      status: record.status || 'completed',
      teacherId: record.teacherId && record.teacherId !== 'NULL' ? parseInt(record.teacherId, 10) : null,
      invoiceDone: record.InvoiceDone?.toUpperCase() === 'TRUE',
      packageGroupId: null,
      comment: null,
    });
  }
  
  return sessions;
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

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

async function cleanupDatabase(dataSource: DataSource) {
  console.log('\n🧹 Cleaning up database...');
  console.log('   ℹ️  Preserving: users, rooms, discounts\n');
  
  const queryRunner = dataSource.createQueryRunner();
  
  // Tables to clean (NOT including users, rooms, discounts)
  const tables = [
    'receipts',
    'invoice_items',
    'invoices',
    'feedbacks',
    'teacher_absences',
    'course_plus',
    'schedules',
    'sessions',
    'parent_students',
    'parents',
    'students',
    'teacher_courses',
    'teachers',
    'courses',
    'class_options',
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

async function insertClassOptions(dataSource: DataSource, classOptions: ClassOption[]) {
  console.log(`\n📦 Inserting ${classOptions.length} class options...`);
  
  for (const option of classOptions) {
    await dataSource.query(
      `INSERT INTO class_options (id, "classMode", "classLimit", "tuitionFee", "effectiveStartDate", "effectiveEndDate")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         "classMode" = EXCLUDED."classMode",
         "classLimit" = EXCLUDED."classLimit",
         "tuitionFee" = EXCLUDED."tuitionFee"`,
      [option.id, option.classMode, option.classLimit, option.tuitionFee, option.effectiveStartDate, option.effectiveEndDate]
    );
  }
  
  // Reset sequence
  const maxId = Math.max(...classOptions.map(o => o.id));
  await dataSource.query(`SELECT setval('class_options_id_seq', $1, true)`, [maxId]);
  
  console.log(`   ✅ Inserted class options`);
}

async function insertCourses(dataSource: DataSource, courses: Course[]) {
  console.log(`\n📚 Inserting ${courses.length} courses...`);
  
  for (const course of courses) {
    await dataSource.query(
      `INSERT INTO courses (id, title, description, "ageRange", medium)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         "ageRange" = EXCLUDED."ageRange",
         medium = EXCLUDED.medium`,
      [course.id, course.title, course.description, course.ageRange, course.medium]
    );
  }
  
  // Reset sequence
  const maxId = Math.max(...courses.map(c => c.id));
  await dataSource.query(`SELECT setval('courses_id_seq', $1, true)`, [maxId]);
  
  console.log(`   ✅ Inserted courses`);
}

async function insertTeachers(dataSource: DataSource, teachers: Teacher[]) {
  console.log(`\n👨‍🏫 Inserting ${teachers.length} teachers...`);
  
  const SALT_ROUNDS = 10;
  
  for (const teacher of teachers) {
    // Hash the password using bcrypt
    const hashedPassword = teacher.password 
      ? await bcrypt.hash(teacher.password, SALT_ROUNDS)
      : await bcrypt.hash('kdl123456', SALT_ROUNDS); // Default password
    
    await dataSource.query(
      `INSERT INTO teachers (id, name, email, password, "contactNo", "lineId", address, "profilePicture", "profileKey")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         password = EXCLUDED.password`,
      [teacher.id, teacher.name, teacher.email, hashedPassword, teacher.contactNo, teacher.lineId, teacher.address, teacher.profilePicture, teacher.profileKey]
    );
  }
  
  // Reset sequence
  const maxId = Math.max(...teachers.map(t => t.id));
  await dataSource.query(`SELECT setval('teachers_id_seq', $1, true)`, [maxId]);
  
  console.log(`   ✅ Inserted teachers with hashed passwords`);
}

async function insertStudents(dataSource: DataSource, students: Student[]): Promise<Map<string, number>> {
  console.log(`\n🎓 Inserting ${students.length} students...`);
  
  const studentIdMap = new Map<string, number>();
  
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
    student.dbId = dbId; // Store dbId for later use
  }
  
  console.log(`   ✅ Inserted students`);
  return studentIdMap;
}

async function insertSessions(dataSource: DataSource, sessions: Session[]) {
  console.log(`\n📋 Inserting ${sessions.length} sessions...`);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const session of sessions) {
    try {
      await dataSource.query(
        `INSERT INTO sessions (id, "studentId", "courseId", "classOptionId", "classCancel", payment, status, "teacherId", "invoiceDone", "packageGroupId", comment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           "studentId" = EXCLUDED."studentId",
           "courseId" = EXCLUDED."courseId",
           "classOptionId" = EXCLUDED."classOptionId",
           "classCancel" = EXCLUDED."classCancel",
           payment = EXCLUDED.payment,
           status = EXCLUDED.status`,
        [
          session.id,
          session.studentId,
          session.courseId,
          session.classOptionId,
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
  
  // Reset sequence
  if (sessions.length > 0) {
    const maxId = Math.max(...sessions.map(s => s.id));
    await dataSource.query(`SELECT setval('sessions_id_seq', $1, true)`, [maxId]);
  }
  
  console.log(`   ✅ Inserted ${inserted} sessions, skipped ${skipped}`);
}

async function insertSchedules(dataSource: DataSource, schedules: Schedule[]) {
  console.log(`\n📅 Inserting ${schedules.length} schedules...`);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const schedule of schedules) {
    try {
      await dataSource.query(
        `INSERT INTO schedules ("sessionId", "studentId", "courseId", "teacherId", date, "startTime", "endTime", room, attendance, remark, warning, feedback, "verifyFb")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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
      // Ignore duplicates or FK errors
    }
  }
  
  console.log(`   ✅ Inserted ${inserted} teacher-course relationships`);
}

// Generate invoices and receipts for completed/paid sessions
async function generateInvoicesForCompletedSessions(
  dataSource: DataSource,
  sessions: Session[],
  students: Student[],
  courses: Course[],
  classOptions: ClassOption[]
) {
  // Filter sessions that are completed and paid
  const completedPaidSessions = sessions.filter(
    s => s.status === 'completed' && s.payment === 'Paid'
  );
  
  if (completedPaidSessions.length === 0) {
    console.log('\n💰 No completed/paid sessions found for invoice generation');
    return;
  }
  
  console.log(`\n💰 Generating invoices for ${completedPaidSessions.length} completed/paid sessions...`);
  
  // Create lookup maps
  const studentMap = new Map(students.map(s => [s.dbId!, s]));
  const courseMap = new Map(courses.map(c => [c.id, c]));
  const classOptionMap = new Map(classOptions.map(o => [o.id, o]));
  
  let invoicesCreated = 0;
  let receiptsCreated = 0;
  let errors = 0;
  
  // Group sessions by year for document numbering
  const sessions2024 = completedPaidSessions.filter(s => {
    const course = courseMap.get(s.courseId);
    return course && course.title.includes('2024');
  });
  const sessions2025 = completedPaidSessions.filter(s => {
    const course = courseMap.get(s.courseId);
    return course && !course.title.includes('2024');
  });
  
  let invoiceNum2024 = 1;
  let invoiceNum2025 = 1;
  
  for (const session of completedPaidSessions) {
    const student = studentMap.get(session.studentId);
    const course = courseMap.get(session.courseId);
    const classOption = classOptionMap.get(session.classOptionId);
    
    if (!student || !course || !classOption) {
      console.log(`   ⚠️  Missing data for session ${session.id} (student: ${!!student}, course: ${!!course}, classOption: ${!!classOption})`);
      errors++;
      continue;
    }
    
    // Determine year and document ID
    const is2024 = course.title.includes('2024');
    const year = is2024 ? '2024' : '2025';
    const invoiceNum = is2024 ? invoiceNum2024++ : invoiceNum2025++;
    const documentId = `INV-${year}-${String(invoiceNum).padStart(4, '0')}`;
    
    // Get tuition amount from class option
    const totalAmount = classOption.tuitionFee;
    
    // Create session group data (JSON for invoice)
    const sessionGroups = [{
      sessionId: String(session.id),
      transactionType: 'course' as const,
      actualId: String(session.id),
    }];
    
    // Estimate invoice date based on session's course start (or use a default)
    // Since we don't have exact payment date, use start of the course's year
    const invoiceDate = is2024 ? new Date('2024-01-15') : new Date('2025-01-15');
    
    try {
      // Insert invoice
      const invoiceResult = await dataSource.query(
        `INSERT INTO invoices ("documentId", date, "paymentMethod", "totalAmount", "studentId", "studentName", "courseName", "sessionGroups", "receiptDone")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          documentId,
          invoiceDate,
          'Cash', // Default payment method for historical data
          totalAmount,
          student.dbId,
          student.name,
          course.title,
          JSON.stringify(sessionGroups),
          true, // Receipt done since these are paid
        ]
      );
      
      const invoiceId = invoiceResult[0].id;
      invoicesCreated++;
      
      // Insert invoice item
      await dataSource.query(
        `INSERT INTO invoice_items ("invoiceId", description, amount)
         VALUES ($1, $2, $3)`,
        [
          invoiceId,
          `${classOption.classMode} - ${course.title}`,
          totalAmount,
        ]
      );
      
      // Insert receipt
      await dataSource.query(
        `INSERT INTO receipts ("invoiceId", date)
         VALUES ($1, $2)`,
        [invoiceId, invoiceDate]
      );
      receiptsCreated++;
      
      // Update session to mark invoice done
      await dataSource.query(
        `UPDATE sessions SET "invoiceDone" = true WHERE id = $1`,
        [session.id]
      );
      
    } catch (error: any) {
      console.log(`   ⚠️  Invoice for session ${session.id} failed: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`   ✅ Created ${invoicesCreated} invoices, ${receiptsCreated} receipts`);
  if (errors > 0) {
    console.log(`   ⚠️  ${errors} errors encountered`);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const doCleanup = args.includes('--cleanup');
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           CSV Data Migration Script                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  if (isDryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  // Check CSV files exist
  console.log('\n📁 Checking CSV files...');
  for (const [name, filePath] of Object.entries(CSV_FILES)) {
    const exists = fs.existsSync(filePath);
    console.log(`   ${exists ? '✅' : '❌'} ${name}: ${path.basename(filePath)}`);
  }
  
  // Parse CSV files
  console.log('\n📖 Parsing CSV files...');
  
  const students2024Raw = parseCSV(CSV_FILES.students2024);
  const students2025Raw = parseCSV(CSV_FILES.students2025);
  const coursesRaw = parseCSV(CSV_FILES.courses);
  const teachersRaw = parseCSV(CSV_FILES.teachers);
  const classOptionsRaw = parseCSV(CSV_FILES.classOptions);
  const sessions2024Raw = parseCSV(CSV_FILES.sessions2024);
  const sessions2025Raw = parseCSV(CSV_FILES.sessions2025);
  const schedulesRaw = parseCSV(CSV_FILES.schedules);
  
  console.log(`   Students 2024: ${students2024Raw.length} records`);
  console.log(`   Students 2025: ${students2025Raw.length} records`);
  console.log(`   Courses: ${coursesRaw.length} records`);
  console.log(`   Teachers: ${teachersRaw.length} records`);
  console.log(`   Class Options: ${classOptionsRaw.length} records`);
  console.log(`   Sessions 2024: ${sessions2024Raw.length} records`);
  console.log(`   Sessions 2025: ${sessions2025Raw.length} records`);
  console.log(`   Schedules: ${schedulesRaw.length} records`);
  
  // Transform data
  console.log('\n🔄 Transforming data...');
  
  const students = transformStudents(students2024Raw, students2025Raw);
  const courses = transformCourses(coursesRaw);
  const teachers = transformTeachers(teachersRaw);
  const classOptions = transformClassOptions(classOptionsRaw);
  
  console.log(`   Merged students: ${students.length} (deduplicated)`);
  console.log(`   Courses: ${courses.length}`);
  console.log(`   Teachers: ${teachers.length}`);
  console.log(`   Class Options: ${classOptions.length}`);
  
  if (isDryRun) {
    console.log('\n📊 Dry run summary:');
    console.log(`   Would insert ${students.length} students`);
    console.log(`   Would insert ${courses.length} courses`);
    console.log(`   Would insert ${teachers.length} teachers`);
    console.log(`   Would insert ${classOptions.length} class options`);
    console.log(`   Would insert ~${sessions2024Raw.length + sessions2025Raw.length} sessions`);
    console.log(`   Would insert ~${schedulesRaw.length} schedules`);
    console.log('\n✅ Dry run complete. Run without --dry-run to execute migration.');
    return;
  }
  
  // Connect to database
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
    console.log('   ✅ Connected to database');
    
    // Cleanup if requested
    if (doCleanup) {
      await cleanupDatabase(dataSource);
    }
    
    // Insert base data
    await insertClassOptions(dataSource, classOptions);
    await insertCourses(dataSource, courses);
    await insertTeachers(dataSource, teachers);
    
    // Insert students and get ID mapping
    const studentIdMap = await insertStudents(dataSource, students);
    console.log(`   📍 Created mapping for ${studentIdMap.size} students`);
    
    // Create validation sets
    const validCourseIds = new Set(courses.map(c => c.id));
    const validClassOptionIds = new Set(classOptions.map(o => o.id));
    
    // Transform and insert sessions
    const sessions2025 = transformSessions2025(sessions2025Raw, studentIdMap, validCourseIds, validClassOptionIds);
    const maxSessionId2025 = sessions2025.length > 0 ? Math.max(...sessions2025.map(s => s.id)) : 0;
    const sessions2024 = transformSessions2024(sessions2024Raw, studentIdMap, validCourseIds, validClassOptionIds, maxSessionId2025 + 1);
    
    const allSessions = [...sessions2025, ...sessions2024];
    console.log(`\n   Sessions 2025: ${sessions2025.length} valid`);
    console.log(`   Sessions 2024: ${sessions2024.length} valid`);
    
    await insertSessions(dataSource, allSessions);
    
    // Transform and insert schedules
    const validSessionIds = new Set(allSessions.map(s => s.id));
    const schedules = transformSchedules(schedulesRaw, studentIdMap, validSessionIds, validCourseIds);
    
    await insertSchedules(dataSource, schedules);
    
    // Extract and insert teacher_courses from schedule data
    await insertTeacherCourses(dataSource, schedulesRaw);
    
    // Generate invoices and receipts for completed/paid sessions
    await generateInvoicesForCompletedSessions(dataSource, allSessions, students, courses, classOptions);
    
    // Final summary
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    Migration Complete!                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    
    const counts = await dataSource.query(`
      SELECT 'students' as table_name, COUNT(*)::int as count FROM students
      UNION ALL SELECT 'courses', COUNT(*)::int FROM courses
      UNION ALL SELECT 'teachers', COUNT(*)::int FROM teachers
      UNION ALL SELECT 'class_options', COUNT(*)::int FROM class_options
      UNION ALL SELECT 'sessions', COUNT(*)::int FROM sessions
      UNION ALL SELECT 'schedules', COUNT(*)::int FROM schedules
      UNION ALL SELECT 'teacher_courses', COUNT(*)::int FROM teacher_courses
      UNION ALL SELECT 'invoices', COUNT(*)::int FROM invoices
      UNION ALL SELECT 'receipts', COUNT(*)::int FROM receipts
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
