/**
 * Additional Course Consolidation
 * 
 * Merges remaining duplicate/typo courses identified in review
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../..');
const OCR_OUTPUT_DIR = path.join(ROOT_DIR, 'ocr-output-gemini');
const COURSES_CSV = path.join(ROOT_DIR, 'courses_master.csv');

// Mapping: oldId → newId (canonical)
const CONSOLIDATION_MAP: Record<number, number> = {
  69: 71,   // Roblock → Roblox Beginner (typo)
  81: 64,   // K-Intermediate → K-mBot Intermediate I
  87: 78,   // VEX → VEX Beginner
  88: 56,   // Halocode → Halocode Beginner
  95: 90,   // IGCSE → IGCSE Computer Science
  107: 80,  // K-Intermediate3 → K-mBot Intermediate II
  122: 62,  // mBot Intermediate → C-mBot Intermediate I
  124: 64,  // K-Intermedaite (typo) → K-mBot Intermediate I
  132: 64,  // K- Intermediate → K-mBot Intermediate I
  139: 1,   // Tinkamo → Tinkamo Tinkerer Begineer
  143: 83,  // Tinkercad. → 3D TInkercad
  145: 80,  // K-Intermediate II → K-mBot Intermediate II
  152: 101, // Arduino I+II → Arduino I + II
  154: 84,  // Tinkamo Intermedict 2 (typo) → Tinkamo Intermediate
  160: 16,  // Game Creatoe (typo) → Animation and Game Creator
};

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

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Additional Course Consolidation                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const idsToRemove = new Set(Object.keys(CONSOLIDATION_MAP).map(Number));
  
  console.log(`📊 Will consolidate ${idsToRemove.size} courses into canonical IDs\n`);
  
  // Step 1: Update all sessions
  console.log('📁 Updating sessions across all years...\n');
  
  const yearFolders = fs.readdirSync(OCR_OUTPUT_DIR)
    .filter(name => /^\d{4}(-\d{4})?$/.test(name))
    .sort();
  
  let totalUpdated = 0;
  
  for (const year of yearFolders) {
    const sessionsPath = path.join(OCR_OUTPUT_DIR, year, 'sessions.csv');
    if (!fs.existsSync(sessionsPath)) continue;
    
    const content = fs.readFileSync(sessionsPath, 'utf-8');
    const lines = content.split('\n');
    const headers = parseCSVLine(lines[0]);
    const courseIdIndex = headers.findIndex(h => h.trim().toLowerCase() === 'courseid');
    
    let updatedCount = 0;
    const newLines = [lines[0]];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const parts = parseCSVLine(lines[i]);
      const oldId = parseInt(parts[courseIdIndex]);
      
      if (CONSOLIDATION_MAP[oldId]) {
        parts[courseIdIndex] = CONSOLIDATION_MAP[oldId].toString();
        updatedCount++;
      }
      
      newLines.push(parts.join(','));
    }
    
    console.log(`   ${year}: ${updatedCount} sessions updated`);
    totalUpdated += updatedCount;
    
    fs.writeFileSync(sessionsPath, newLines.join('\n') + '\n');
  }
  
  console.log(`\n📊 Total sessions updated: ${totalUpdated}`);
  
  // Step 2: Remove consolidated courses from courses_master.csv
  console.log('\n📝 Removing consolidated courses from courses_master.csv...');
  
  const coursesContent = fs.readFileSync(COURSES_CSV, 'utf-8');
  const courseLines = coursesContent.split('\n');
  const newCourseLines = [courseLines[0]]; // Keep header
  
  let removedCount = 0;
  for (let i = 1; i < courseLines.length; i++) {
    if (!courseLines[i].trim()) continue;
    
    const parts = parseCSVLine(courseLines[i]);
    const courseId = parseInt(parts[0]);
    
    if (idsToRemove.has(courseId)) {
      console.log(`   Removing: ${courseId} - ${parts[1]}`);
      removedCount++;
    } else {
      newCourseLines.push(courseLines[i]);
    }
  }
  
  fs.writeFileSync(COURSES_CSV, newCourseLines.join('\n') + '\n');
  
  console.log(`\n📊 Removed ${removedCount} duplicate courses`);
  console.log(`📊 Courses remaining: ${newCourseLines.length - 1}`);
  
  console.log('\n✅ Done!');
}

main().catch(console.error);
