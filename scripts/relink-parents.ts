/**
 * Re-link Parents to Students
 * 
 * Fixes the parent-student relationships without re-running full migration
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../..');
const OCR_OUTPUT_DIR = path.join(ROOT_DIR, 'ocr-output-gemini');

function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim());
  const records: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() || '';
    });
    records.push(record);
  }
  return records;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Re-Link Parents to Students                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  // Connect to database
  console.log('🔌 Connecting to database...');
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
    logging: false,
  });
  
  await dataSource.initialize();
  console.log('   ✅ Connected\n');
  
  // Get existing students and parents from DB
  console.log('📖 Loading existing data from database...');
  const dbStudents = await dataSource.query(`SELECT id, "studentId" FROM students`);
  const dbParents = await dataSource.query(`SELECT id, name, "contactNo" FROM parents`);
  
  const studentIdMap = new Map<string, number>();
  for (const s of dbStudents) {
    studentIdMap.set(s.studentId, s.id);
  }
  
  const parentIdMap = new Map<string, number>();
  for (const p of dbParents) {
    const key = `${p.name.toLowerCase()}_${(p.contactNo || '').trim()}`;
    parentIdMap.set(key, p.id);
  }
  
  console.log(`   Students: ${studentIdMap.size}`);
  console.log(`   Parents: ${parentIdMap.size}\n`);
  
  // First, insert any missing parents from OCR data
  console.log('👨‍👩‍👧 Checking for missing parents to insert...\n');
  let insertedParents = 0;
  
  for (const yearFolder of fs.readdirSync(OCR_OUTPUT_DIR).filter(n => /^\d{4}(-\d{4})?$/.test(n))) {
    if (yearFolder.startsWith('2025')) continue;
    
    const parentsFile = path.join(OCR_OUTPUT_DIR, yearFolder, 'parents.csv');
    if (!fs.existsSync(parentsFile)) continue;
    
    const parents = parseCSV(parentsFile);
    
    for (const parent of parents) {
      const name = parent.name?.trim();
      const contactNo = (parent.phone || parent.contactNo || '').trim();
      if (!name) continue;
      
      const key = `${name.toLowerCase()}_${contactNo}`;
      
      // Skip if already in DB
      if (parentIdMap.has(key)) continue;
      
      try {
        const result = await dataSource.query(
          `INSERT INTO parents (name, email, "contactNo", "lineId", address)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [name, parent.email || '', contactNo, parent.lineId || '', parent.address || '']
        );
        
        if (result.length > 0) {
          parentIdMap.set(key, result[0].id);
          insertedParents++;
          console.log(`   ✅ Inserted missing parent: ${name}`);
        }
      } catch (error: any) {
        console.log(`   ⚠️  Failed to insert ${name}: ${error.message}`);
      }
    }
  }
  
  console.log(`\n   Inserted ${insertedParents} missing parents\n`);
  
  // Process each year folder
  console.log('🔗 Linking parents to students...\n');
  
  const yearFolders = fs.readdirSync(OCR_OUTPUT_DIR)
    .filter(name => /^\d{4}(-\d{4})?$/.test(name))
    .sort();
  
  let totalLinked = 0;
  let totalSkipped = 0;
  
  for (const yearFolder of yearFolders) {
    if (yearFolder.startsWith('2025')) continue;
    
    const studentsFile = path.join(OCR_OUTPUT_DIR, yearFolder, 'students.csv');
    const parentsFile = path.join(OCR_OUTPUT_DIR, yearFolder, 'parents.csv');
    
    if (!fs.existsSync(studentsFile) || !fs.existsSync(parentsFile)) continue;
    
    const students = parseCSV(studentsFile);
    const parents = parseCSV(parentsFile);
    
    // Create maps by sourceImage
    const studentsByImage = new Map<string, any>();
    const parentsByImage = new Map<string, { parent: any; key: string }>();
    
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
      const contactNo = (parent.phone || parent.contactNo || '').trim();
      if (sourceImage && parentName) {
        const key = `${parentName.toLowerCase()}_${contactNo}`;
        parentsByImage.set(sourceImage, { parent, key });
      }
    }
    
    let linked = 0;
    let skipped = 0;
    
    for (const [sourceImage, student] of studentsByImage.entries()) {
      const parentData = parentsByImage.get(sourceImage);
      if (!parentData) {
        skipped++;
        continue;
      }
      
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
        
        const isPrimary = existingPrimary.length === 0;
        
        await dataSource.query(
          `INSERT INTO parent_students ("parentId", "studentId", "isPrimary")
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [dbParentId, dbStudentId, isPrimary]
        );
        linked++;
      } catch (error: any) {
        skipped++;
      }
    }
    
    console.log(`   ${yearFolder}: ${linked} linked, ${skipped} skipped`);
    totalLinked += linked;
    totalSkipped += skipped;
  }
  
  await dataSource.destroy();
  
  console.log(`\n✅ Done! Linked ${totalLinked} parent-student relationships, skipped ${totalSkipped}`);
}

main().catch(console.error);
