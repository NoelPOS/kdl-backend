/**
 * Renumber Course IDs Sequentially
 * 
 * Takes the current courses_master.csv (with gaps like 1-103, 108, 112, 127...)
 * and renumbers them to be sequential (1, 2, 3... 168)
 * Then updates ALL session files to use the new IDs
 * 
 * Usage:
 *   npx ts-node scripts/renumber-courses.ts --dry-run
 *   npx ts-node scripts/renumber-courses.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../..');
const OCR_OUTPUT_DIR = path.join(ROOT_DIR, 'ocr-output-gemini');
const COURSES_CSV = path.join(ROOT_DIR, 'courses_master.csv');
const COURSES_BACKUP2 = path.join(ROOT_DIR, 'courses_master_before_renumber.csv');
const MAPPING_OUTPUT = path.join(ROOT_DIR, 'course_id_mapping.csv');

const DRY_RUN = process.argv.includes('--dry-run');

// ============================================================
// CSV PARSING
// ============================================================

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

interface CourseRecord {
  id: number;
  title: string;
  description: string;
  ageRange: string;
  medium: string;
  sourceImage: string;
}

function parseCoursesCSV(filePath: string): CourseRecord[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const courses: CourseRecord[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length >= 2 && parts[0]) {
      courses.push({
        id: parseInt(parts[0]) || 0,
        title: parts[1] || '',
        description: parts[2] || '',
        ageRange: parts[3] || '',
        medium: parts[4] || '',
        sourceImage: parts[5] || '',
      });
    }
  }
  
  return courses;
}

function parseSessionsCSV(filePath: string): { headers: string[], lines: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  return {
    headers: lines[0] ? parseCSVLine(lines[0]) : [],
    lines: lines.slice(1).filter(l => l.trim()),
  };
}

// ============================================================
// MAIN LOGIC
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Renumber Course IDs Sequentially                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }
  
  // Step 1: Load current courses and create mapping
  console.log('📖 Loading courses_master.csv...');
  const courses = parseCoursesCSV(COURSES_CSV);
  console.log(`   Found ${courses.length} courses\n`);
  
  // Sort by current ID to maintain relative order
  courses.sort((a, b) => a.id - b.id);
  
  // Create old ID → new ID mapping
  const idMapping = new Map<number, number>();
  const mappingReport: string[] = ['oldId,newId,title'];
  
  for (let i = 0; i < courses.length; i++) {
    const oldId = courses[i].id;
    const newId = i + 1;  // Sequential starting from 1
    idMapping.set(oldId, newId);
    mappingReport.push(`${oldId},${newId},"${courses[i].title}"`);
  }
  
  console.log('📊 ID Mapping Created:');
  console.log(`   Old range: ${courses[0].id} to ${courses[courses.length - 1].id} (with gaps)`);
  console.log(`   New range: 1 to ${courses.length} (sequential)\n`);
  
  // Show some example mappings
  console.log('📋 Sample mappings:');
  let count = 0;
  for (const [oldId, newId] of idMapping) {
    if (oldId !== newId && count < 10) {
      const course = courses.find(c => c.id === oldId);
      console.log(`   ${oldId} → ${newId}: ${course?.title}`);
      count++;
    }
  }
  if (count === 0) {
    console.log('   (All IDs already sequential!)');
  }
  console.log('');
  
  // Step 2: Update all sessions across all years
  console.log('📁 Updating sessions across all years...\n');
  
  const yearFolders = fs.readdirSync(OCR_OUTPUT_DIR)
    .filter(name => /^\d{4}(-\d{4})?$/.test(name))
    .sort();
  
  let totalSessionsUpdated = 0;
  
  for (const year of yearFolders) {
    const sessionsPath = path.join(OCR_OUTPUT_DIR, year, 'sessions.csv');
    
    if (!fs.existsSync(sessionsPath)) {
      console.log(`   ${year}: No sessions.csv found`);
      continue;
    }
    
    const { headers, lines } = parseSessionsCSV(sessionsPath);
    const courseIdIndex = headers.findIndex(h => h.trim().toLowerCase() === 'courseid');
    
    if (courseIdIndex === -1) {
      console.log(`   ${year}: No courseId column found!`);
      continue;
    }
    
    let updatedCount = 0;
    const newLines: string[] = [];
    
    for (const line of lines) {
      const parts = parseCSVLine(line);
      const oldCourseId = parseInt(parts[courseIdIndex]);
      const newCourseId = idMapping.get(oldCourseId);
      
      if (newCourseId && newCourseId !== oldCourseId) {
        parts[courseIdIndex] = newCourseId.toString();
        updatedCount++;
      } else if (!newCourseId && oldCourseId) {
        console.log(`   ⚠️  ${year}: courseId ${oldCourseId} not found in mapping!`);
      }
      
      newLines.push(parts.join(','));
    }
    
    console.log(`   ${year}: ${lines.length} sessions, ${updatedCount} IDs updated`);
    totalSessionsUpdated += updatedCount;
    
    if (!DRY_RUN) {
      const output = [headers.join(','), ...newLines].join('\n') + '\n';
      fs.writeFileSync(sessionsPath, output);
    }
  }
  
  console.log(`\n📊 Total session IDs updated: ${totalSessionsUpdated}`);
  
  // Step 3: Rewrite courses_master.csv with new sequential IDs
  console.log('\n📝 Rewriting courses_master.csv with sequential IDs...');
  
  if (!DRY_RUN) {
    // Backup current file
    fs.copyFileSync(COURSES_CSV, COURSES_BACKUP2);
    console.log(`   Backup saved: courses_master_before_renumber.csv`);
    
    // Write with new IDs
    const outputLines = ['id,title,description,ageRange,medium,sourceImage'];
    for (let i = 0; i < courses.length; i++) {
      const c = courses[i];
      const newId = i + 1;
      const escapedTitle = c.title.includes(',') ? `"${c.title}"` : c.title;
      outputLines.push(`${newId},${escapedTitle},${c.description},${c.ageRange},${c.medium},${c.sourceImage}`);
    }
    fs.writeFileSync(COURSES_CSV, outputLines.join('\n') + '\n');
    
    // Save mapping for reference
    fs.writeFileSync(MAPPING_OUTPUT, mappingReport.join('\n') + '\n');
    console.log(`   Mapping saved: course_id_mapping.csv`);
  }
  
  console.log('\n✅ Done! All course IDs are now sequential (1 to ' + courses.length + ')');
  
  if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run to apply changes');
  }
}

main().catch(console.error);
