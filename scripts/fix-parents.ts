/**
 * Fix Parents and Re-link
 * 
 * 1. Truncates parent_students table
 * 2. Truncates and re-populates parents table (to fix duplicates)
 * 3. Re-links parents to students using sourceImage matching
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

function getOCRYearFolders(): string[] {
  return fs.readdirSync(OCR_OUTPUT_DIR)
    .filter(name => /^\d{4}(-\d{4})?$/.test(name))
    .sort();
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Fix Parents and Re-link to Students                      ║');
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
  
  // Step 1: Clean up
  console.log('🧹 Cleaning up...');
  await dataSource.query('TRUNCATE TABLE parent_students CASCADE');
  console.log('   ✅ Truncated parent_students');
  await dataSource.query('TRUNCATE TABLE parents CASCADE');
  console.log('   ✅ Truncated parents\n');
  
  // Step 2: Collect all unique parents from OCR data
  console.log('📖 Loading parents from OCR data...');
  const parentMap = new Map<string, any>();
  const yearFolders = getOCRYearFolders();
  
  for (const yearFolder of yearFolders) {
    if (yearFolder.startsWith('2025')) continue;
    
    const parentsFile = path.join(OCR_OUTPUT_DIR, yearFolder, 'parents.csv');
    if (!fs.existsSync(parentsFile)) continue;
    
    const records = parseCSV(parentsFile);
    console.log(`   ${yearFolder}: ${records.length} parents`);
    
    for (const record of records) {
      const name = record.name?.trim();
      if (!name) continue;
      
      const contactNo = (record.phone || record.contactNo || '').trim();
      const key = `${name.toLowerCase()}_${contactNo}`;
      
      if (!parentMap.has(key)) {
        parentMap.set(key, {
          name,
          email: record.email || '',
          contactNo,
          lineId: record.lineId || '',
          address: record.address || '',
        });
      }
    }
  }
  
  console.log(`\n   Total unique parents: ${parentMap.size}\n`);
  
  // Step 3: Insert parents
  console.log('👨‍👩‍👧 Inserting parents...');
  const parentIdMap = new Map<string, number>();
  let inserted = 0;
  
  for (const [key, parent] of parentMap.entries()) {
    try {
      const result = await dataSource.query(
        `INSERT INTO parents (name, email, "contactNo", "lineId", address)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [parent.name, parent.email, parent.contactNo, parent.lineId, parent.address]
      );
      
      if (result.length > 0) {
        parentIdMap.set(key, result[0].id);
        inserted++;
      }
    } catch (error: any) {
      console.log(`   ⚠️  Failed: ${parent.name}: ${error.message}`);
    }
  }
  
  console.log(`   ✅ Inserted ${inserted} parents\n`);
  
  // Step 4: Get student ID map from DB
  console.log('📖 Loading students from database...');
  const dbStudents = await dataSource.query(`SELECT id, "studentId" FROM students`);
  const studentIdMap = new Map<string, number>();
  for (const s of dbStudents) {
    studentIdMap.set(s.studentId, s.id);
  }
  console.log(`   Found ${studentIdMap.size} students\n`);
  
  // Step 5: Link parents to students by sourceImage
  console.log('🔗 Linking parents to students...\n');
  let totalLinked = 0;
  let totalSkipped = 0;
  
  for (const yearFolder of yearFolders) {
    if (yearFolder.startsWith('2025')) continue;
    
    const studentsFile = path.join(OCR_OUTPUT_DIR, yearFolder, 'students.csv');
    const parentsFile = path.join(OCR_OUTPUT_DIR, yearFolder, 'parents.csv');
    
    if (!fs.existsSync(studentsFile) || !fs.existsSync(parentsFile)) continue;
    
    const students = parseCSV(studentsFile);
    const parents = parseCSV(parentsFile);
    
    // Map by sourceImage
    const studentsByImage = new Map<string, any>();
    const parentsByImage = new Map<string, { key: string }>();
    
    for (const student of students) {
      const sourceImage = student.sourceImage?.trim();
      const studentId = student.studentId?.trim();
      if (sourceImage && studentId) {
        studentsByImage.set(sourceImage, student);
      }
    }
    
    for (const parent of parents) {
      const sourceImage = parent.sourceImage?.trim();
      const name = parent.name?.trim();
      const contactNo = (parent.phone || parent.contactNo || '').trim();
      if (sourceImage && name) {
        const key = `${name.toLowerCase()}_${contactNo}`;
        parentsByImage.set(sourceImage, { key });
      }
    }
    
    let linked = 0;
    let skipped = 0;
    const skippedReasons: string[] = [];
    
    for (const [sourceImage, student] of studentsByImage.entries()) {
      const parentData = parentsByImage.get(sourceImage);
      if (!parentData) {
        skipped++;
        skippedReasons.push(`No parent found for image: ${sourceImage}`);
        continue;
      }
      
      const studentId = student.studentId?.trim();
      const dbStudentId = studentIdMap.get(studentId);
      const dbParentId = parentIdMap.get(parentData.key);
      
      if (!dbStudentId) {
        skipped++;
        skippedReasons.push(`Student not in DB: ${studentId}`);
        continue;
      }
      
      if (!dbParentId) {
        skipped++;
        skippedReasons.push(`Parent key not found: ${parentData.key}`);
        continue;
      }
      
      try {
        const existing = await dataSource.query(
          `SELECT id FROM parent_students WHERE "parentId" = $1 AND "studentId" = $2`,
          [dbParentId, dbStudentId]
        );
        
        if (existing.length > 0) {
          skipped++;
          continue;
        }
        
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
        skippedReasons.push(`Error linking: ${error.message}`);
      }
    }
    
    console.log(`   ${yearFolder}: ${linked} linked, ${skipped} skipped`);
    if (skippedReasons.length > 0 && skippedReasons.length <= 10) {
      skippedReasons.forEach(r => console.log(`      - ${r}`));
    } else if (skippedReasons.length > 10) {
      skippedReasons.slice(0, 5).forEach(r => console.log(`      - ${r}`));
      console.log(`      ... and ${skippedReasons.length - 5} more`);
    }
    
    totalLinked += linked;
    totalSkipped += skipped;
  }
  
  // Final counts
  const finalParents = await dataSource.query(`SELECT COUNT(*) FROM parents`);
  const finalLinks = await dataSource.query(`SELECT COUNT(*) FROM parent_students`);
  
  await dataSource.destroy();
  
  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║                     Complete!                                ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);
  console.log(`\n📊 Final counts:`);
  console.log(`   Parents: ${finalParents[0].count}`);
  console.log(`   Parent-Student links: ${finalLinks[0].count}`);
}

main().catch(console.error);
