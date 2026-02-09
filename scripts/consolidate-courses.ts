/**
 * Course Consolidation Script
 * 
 * Consolidates ~960 OCR-generated duplicate courses into canonical courses
 * and updates all session references across 2019-2024.
 * 
 * Usage:
 *   npx ts-node scripts/consolidate-courses.ts --dry-run
 *   npx ts-node scripts/consolidate-courses.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../..');
const OCR_OUTPUT_DIR = path.join(ROOT_DIR, 'ocr-output-gemini');
const COURSES_CSV = path.join(ROOT_DIR, 'courses_master.csv');
const COURSES_BACKUP = path.join(ROOT_DIR, 'courses_master_backup.csv');

const DRY_RUN = process.argv.includes('--dry-run');

// ============================================================
// CANONICAL COURSES (from your official course list 1-103)
// ============================================================

interface CanonicalCourse {
  id: number;
  title: string;
  aliases: string[];  // OCR variations that map to this
}

const CANONICAL_COURSES: CanonicalCourse[] = [
  // Tinkamo
  { id: 1, title: 'Tinkamo Tinkerer Begineer', aliases: ['Tinkamo Beginner', 'Tinkamo Beginner 1', 'Tinkamo Beginner I', 'PK-Tinkamo 1', 'PK-Tinkamo Beginner', 'Tinkamo 1 time', 'Tiunkamo Beginner', 'Tinkano Beginner'] },
  { id: 84, title: 'Tinkamo Intermediate', aliases: ['Tinkamo Int', 'Tinkamo Intermedaite', 'Tinkamo Intermdiate', 'Tinkamo Intermedict', 'Tinkamo Intermedaite II', 'Tinkamo Intermedaite Int', 'PK-Tinkamo Intermediate', 'PK-Tinkamo2', 'PK-Tinkamo 2 -3', 'PK-Tinkamo3', 'Tinkamo Int II', 'Tinkamo Camp', 'Tinkamo 2 days Camp', 'Tinkamo Project'] },
  
  // Botzees
  { id: 58, title: 'Botzees Beginner', aliases: ['Botzees', 'Botzees and mTiny', 'Botzees + mTiny', 'Botzees/mTiny'] },
  { id: 59, title: 'Botzees Intermediate', aliases: ['Botzees Intermediate II', 'Botzees Intermedaite', 'Botzees Intermadiate II', 'Botzees Intermediate +3D'] },
  
  // K-mBot (Kids)
  { id: 60, title: 'K-mBot Beginner', aliases: ['K-mBot', 'K-mBot Benginner', 'K-mBot Begonner', 'K- mBot Beginner', 'KmBot Beginner', 'K-Beginner', 'K-B1', 'K-B2', 'K-B3', 'KB', 'KB1', 'Kid- Beginner', 'Kid Beginner', 'Beginner Kid', 'K- Beginner', 'K-Beginner 1', 'K-Beginner 2', 'K-Beginner 3', 'K-Beginner Summer Camp', 'K-mBot Beginner Summer Camp', 'Full day K-B1 and K-B2', 'mBot Beginner', 'Child: Beginner', 'Child- Beginner', 'Child Beginner'] },
  { id: 64, title: 'K-mBot Intermediate I', aliases: ['K-mBot Intermediate', 'K-Intermediate', 'K-Intermediate 1', 'K-Intermediate1', 'K-Inter', 'K-I1', 'K-mBot Int', 'K-mBot Intermedaite', 'K- mBot Intermediate I', 'Kids-Intermediate', 'Child Intermediate', 'Child: Intermediate', 'K-Intermediate 1/2/3', 'K-Intermediate 6 days Camp'] },
  { id: 80, title: 'K-mBot Intermediate II', aliases: ['K-Intermediate 2', 'K-Intermediate2', 'K-mBot Int II', 'K-mBot Intermedaite II', 'K- mBot Intermediate II', 'k-mBot Int. II + Movie', 'K-mBot Intermediate II + MC Scratch'] },
  
  // C-mBot (Child - older kids)
  { id: 61, title: 'C-mBot Beginner', aliases: ['C-mBot', 'C-B1', 'C-B2', 'C-B3', 'C-BP', 'C-BE', 'C-Beginner', 'C-Beginner1', 'C-Beginner 2', 'C-Beginner Summer', 'C-B1L1', 'CB1L1', 'CT-B1L1', 'Summer Course CB', 'C-mBot Begonner'] },
  { id: 62, title: 'C-mBot Intermediate I', aliases: ['C-mBot Intermediate', 'C-Intermediate', 'C-Intermediate 1', 'C-Intermediate1', 'C-I1', 'C-I2', 'C-mBot Int', 'C-mBot Intermedaite', 'C-Intermediatel', 'C-mBot Intermediate I Camp'] },
  { id: 73, title: 'C-mBot Intermediate II', aliases: ['C-Intermediate 2', 'C-Intermediate2', 'C-mBot Int II', 'C-mBot Intermedaite II', 'C-Intermediate1/2/3', 'C-Intermediate 1-2-3', 'C-Intermediate 3'] },
  
  // Halocode
  { id: 56, title: 'Halocode Beginner', aliases: ['Halocode', 'Halocode.', 'Halo', 'Halocode Joystick', 'Halo Joystick', 'Halocode Cont.', 'C-Halocode', 'C-Halo1', 'C-Halocode Beginner', 'HCIC'] },
  { id: 55, title: 'Halocode Intermediate', aliases: ['Halocode Int', 'Halocode Intermedaite', 'Halo Intermediate', 'Halocode Int Cont.', 'C-Halocode Intermediate', 'C-Halocode Intermedaite', 'C-Halocode2', 'C-Halocode3', 'C-Halocode-Intermediate', 'HalocodeIntermediate'] },
  
  // Animation & Game
  { id: 16, title: 'Animation and Game Creator', aliases: ['Animation and Game', 'Animation & Game Creator', 'Animation & Games Creator', 'Animation&Games', 'Animation and Games', 'Animation and Game-Creator', 'Animation', 'Game Creator', 'Aniimation and Game Creator', 'Animationa and Game Creator', 'Animation and Game Crerator', 'KC-Movie /Animation/Game', 'C-Movie Animation Game', 'C-Movie/Animations/Games', 'C-Movie Animation Games', 'C- Movie1', 'C- Movie2', 'C- Movie3', 'C_Movie', 'C Movie', 'Movie', 'Movie-', 'Game Camp 5 days 5 hrs'] },
  { id: 24, title: 'Advanced Game Creator', aliases: ['Advanced Game', 'Advanced Gane Creator', 'Advanced Games Creator', 'Advanced Games Creator Coaching', 'Advanced Games Creator Coaching I', 'Advanced Games Creator Coaching II', 'Advanced Games Creator Coaching III', 'Advanced Games Creator Coaching IV', 'Advanced Games Creator Coaching VI', 'Game Coaching', 'Game Coachong', 'Game Creator Coaching', 'Game Coaching II', 'C-Games Coaching', 'C-Games Coaching II', 'C-Advance 2'] },
  { id: 25, title: '2 Players Game Creator', aliases: ['2 Players', '2 Player Game Creator'] },
  
  // Codey Rocky
  { id: 76, title: 'Codey Rocky Beginner', aliases: ['Codey Rocky', 'PK-CodeyRocky1', 'PK-CodeyRocky2', 'PK-CodeyRocky3', 'PK-Codey Rocky', 'PK Codey 1', 'Codey Rocky Beginner Int.'] },
  { id: 9, title: 'Codey Rocky Champion Intermediate', aliases: ['Codey Rocky Intermediate', 'Codey Rocky Intermedaite'] },
  
  // Python
  { id: 77, title: 'Python Beginner', aliases: ['Python', 'Python I', 'Pthon I', 'Python Beginner', 'General Python', 'General Python I', 'General Python2', 'General Python II', 'General Python I, II', 'Python Cnt.', 'Python I continue', 'C-Python Beginner', 'Python 12 times'] },
  { id: 63, title: 'Pygame', aliases: ['Pygame I', 'Py game', 'Python Game', 'Game Development with Python', 'Pygame 1 day Workshop'] },
  { id: 96, title: 'Python', aliases: ['Python II', 'Pure Python II', 'Python Intermediate', 'Python-B2', 'C-Python 2 -1', 'C-Python 3', 'Python Project based', 'Python Game Continue', 'Python Project Based'] },
  
  // VEX
  { id: 78, title: 'VEX Beginner', aliases: ['VEX', 'VEX IQ Beginner', 'VEX Robotics Starter'] },
  { id: 57, title: 'VEX Competition Training', aliases: ['VEX Competition', 'VEX IQ Competition', 'VEX Competition I', 'VEX Competition II', 'VEX Competition III', 'VEX IQ Roboticcs Competition I,II', 'VEX continue', 'MakeX 2020 Competition', 'MakeX 2020 Competitiona', 'MakeX Competition Workshop'] },
  
  // Roblox
  { id: 71, title: 'Roblox Beginner', aliases: ['Roblox', 'Roblock'] },
  { id: 72, title: 'Roblox Game Design', aliases: ['Roblox Game Design Beginner', 'Roblox Game Design Intermediate', 'Roblox Halloween', 'Roblox 1 day'] },
  
  // 3D - Keep variants (user requested)
  { id: 68, title: '3D Design and Printing', aliases: [] },
  { id: 83, title: '3D TInkercad', aliases: ['3D Tinkercad', '3D Tinkercad Project', '3D Tinkercad project', '3D (Tinkercad) Project', '3D Project Tinkercad', '3D Tinkercad Porject', '3D Tinkercad camp', '3D Tinkercad 1 day workshop', '3D tinkercad'] },
  { id: 100, title: '3D Shapr3D', aliases: ['3D Shapr3D Project', '3D Shapr3D - II', 'Shapr3D'] },
  { id: 86, title: '3D Design', aliases: ['3D Design Project', '3D Design Project Camp', '3D Design 1 day'] },
  { id: 97, title: '3D Project', aliases: [] },
  { id: 74, title: '3D', aliases: ['3D Course', '3D Printing', '3D Halloween', '3D Tinkamo'] },
  
  // Minecraft
  { id: 13, title: 'Minecraft Education (Scratch)', aliases: ['Minecraft Scratch', 'Minecraft iPad- Scratch', 'Minecraft Education-Scratch', 'Minecraft Edu Scratch', 'MC Scratch', 'Minecraft II', 'Minecraft 3D Theme'] },
  { id: 28, title: 'Minecraft Education (Scratch/Python)', aliases: ['Minecraft Python', 'Minecraft -Python', 'MC-Python', 'Minecraft Education - Python'] },
  
  // Arduino & Electronics
  { id: 101, title: 'Arduino I + II', aliases: ['Arduino I', 'Arduino II', 'Aruduino II', 'Arduino I Continue', 'Arduino II Continue', 'Arduino Python', 'Python & Arduino I', 'Python & Arduino II', 'Python / Arduino', 'Python II and Arduino I'] },
  { id: 32, title: 'Everyday Electronics', aliases: ['Electronics', 'Electronics.', 'Circuit', 'Basic Microcontroller', 'Micro controller'] },
  
  // IoT & Advanced
  { id: 65, title: 'IOT', aliases: ['IoT', 'Welcome to World of IoT', 'IoT Cont.', 'IoT + Robot Arm'] },
  { id: 66, title: 'Robot Arm', aliases: ['Getting to know a Robot Arm'] },
  
  // MIT App Inventor
  { id: 79, title: 'Mit App(1000)', aliases: ['MIT App', 'MIT App Inventor', 'App Design with MIT App Inventor', 'Application Design', 'Application Design (MIT App Inventor)', 'Application Design by MIT App Inventor', 'Application Design with MIT App Inventor'] },
  
  // mTiny
  { id: 6, title: 'Fun Coding with mTIny', aliases: ['mTiny', 'mTiny Beginner'] },
  
  // Lego
  { id: 7, title: 'Fun Coding with Lego Boost', aliases: ['Lego Boost', 'Lego Mindstorm', 'Lego Mindstorm Cont.', 'Boost + minec'] },
  
  // IGCSE
  { id: 90, title: 'IGCSE Computer Science', aliases: ['IGCSE', 'IGCSE Compuerter Science'] },
  { id: 75, title: 'A Level', aliases: [] },
  
  // Digital Literacy
  { id: 93, title: 'Digital Literacy', aliases: ['Ai & Digital Literacy', 'Ai&Digital Literacy', 'AI & Digital Literacy', '1 day Workshop: Ai & Digital Literacy', 'Ai & Digital Literacy 1 day', 'Ai & Digital Literacy workshop'] },
  
  // Full Stack / Web
  { id: 114, title: 'Full Stax', aliases: ['Full Stack'] },
  { id: 34, title: 'Web Design Development', aliases: ['Web Design', 'Website Development', 'Website Project'] },
  
  // UX/UI
  { id: 103, title: 'UX/UI', aliases: [] },
  
  // Special/Camps
  { id: 49, title: 'Free Trial', aliases: [] },
  { id: 98, title: 'Kid 5 days 5 activities', aliases: ['5 days 5 activities'] },
  { id: 94, title: 'Project', aliases: ['Project.', 'Special Project', 'Project Consult'] },
  { id: 53, title: 'TBC', aliases: ['TBC'] },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

function buildMappingTable(): Map<string, number> {
  const mapping = new Map<string, number>();
  
  for (const course of CANONICAL_COURSES) {
    // Map the canonical title itself
    mapping.set(normalizeTitle(course.title), course.id);
    
    // Map all aliases
    for (const alias of course.aliases) {
      mapping.set(normalizeTitle(alias), course.id);
    }
  }
  
  return mapping;
}

interface CourseRecord {
  id: number;
  title: string;
  description?: string;
  ageRange?: string;
  medium?: string;
  sourceImage?: string;
}

function parseCoursesCSV(filePath: string): CourseRecord[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) return [];
  
  const courses: CourseRecord[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length >= 2) {
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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

interface SessionRecord {
  sessionId: string;
  studentId: string;
  courseId: string;
  [key: string]: string;
}

function parseSessionsCSV(filePath: string): { headers: string[], records: SessionRecord[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) return { headers: [], records: [] };
  
  const headers = parseCSVLine(lines[0]);
  const records: SessionRecord[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: SessionRecord = {
      sessionId: '',
      studentId: '',
      courseId: '',
    };
    
    headers.forEach((header, index) => {
      record[header.trim()] = values[index] || '';
    });
    
    records.push(record);
  }
  
  return { headers, records };
}

function writeSessionsCSV(filePath: string, headers: string[], records: SessionRecord[]): void {
  const lines = [headers.join(',')];
  
  for (const record of records) {
    const values = headers.map(h => record[h.trim()] || '');
    lines.push(values.join(','));
  }
  
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

// ============================================================
// MAIN LOGIC
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Course Consolidation Script                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }
  
  // Step 1: Build the mapping table from aliases
  console.log('📚 Building course mapping table...');
  const aliasMapping = buildMappingTable();
  console.log(`   Loaded ${aliasMapping.size} title mappings\n`);
  
  // Step 2: Load all courses and build ID → canonical ID mapping
  console.log('📖 Loading courses_master.csv...');
  const allCourses = parseCoursesCSV(COURSES_CSV);
  console.log(`   Found ${allCourses.length} courses\n`);
  
  const idMapping = new Map<number, number>();  // oldId → canonicalId
  let mappedCount = 0;
  let unmappedCourses: CourseRecord[] = [];
  
  for (const course of allCourses) {
    const normalizedTitle = normalizeTitle(course.title);
    const canonicalId = aliasMapping.get(normalizedTitle);
    
    if (canonicalId) {
      idMapping.set(course.id, canonicalId);
      if (course.id !== canonicalId) {
        mappedCount++;
      }
    } else {
      // Check if this course itself is canonical (ID 1-103)
      if (course.id <= 103) {
        idMapping.set(course.id, course.id);  // Keep as-is
      } else {
        unmappedCourses.push(course);
        idMapping.set(course.id, course.id);  // Keep original ID for now
      }
    }
  }
  
  console.log(`📊 Mapping Summary:`);
  console.log(`   Courses that will be remapped: ${mappedCount}`);
  console.log(`   Courses kept as-is (canonical): ${allCourses.length - mappedCount - unmappedCourses.length}`);
  console.log(`   Unmapped courses (no alias found): ${unmappedCourses.length}\n`);
  
  if (unmappedCourses.length > 0) {
    console.log('⚠️  Unmapped courses (will keep original ID):');
    unmappedCourses.slice(0, 20).forEach(c => {
      console.log(`   ${c.id}: "${c.title}" ← ${c.sourceImage || 'no source'}`);
    });
    if (unmappedCourses.length > 20) {
      console.log(`   ... and ${unmappedCourses.length - 20} more`);
    }
    console.log('');
  }
  
  // Step 3: Process each year's sessions.csv
  console.log('📁 Processing sessions across all years...\n');
  
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
    
    const { headers, records } = parseSessionsCSV(sessionsPath);
    let updatedCount = 0;
    
    for (const record of records) {
      const oldCourseId = parseInt(record.courseId);
      const newCourseId = idMapping.get(oldCourseId);
      
      if (newCourseId && newCourseId !== oldCourseId) {
        record.courseId = newCourseId.toString();
        updatedCount++;
      }
    }
    
    console.log(`   ${year}: ${records.length} sessions, ${updatedCount} course IDs updated`);
    totalSessionsUpdated += updatedCount;
    
    if (!DRY_RUN && updatedCount > 0) {
      writeSessionsCSV(sessionsPath, headers, records);
    }
  }
  
  console.log(`\n📊 Total sessions updated: ${totalSessionsUpdated}`);
  
  // Step 4: Create cleaned courses_master.csv (keep only canonical + unmapped)
  console.log('\n📝 Cleaning courses_master.csv...');
  
  // Get unique canonical IDs that are actually used
  const usedCanonicalIds = new Set<number>();
  for (const [oldId, canonicalId] of idMapping) {
    usedCanonicalIds.add(canonicalId);
  }
  
  // Keep canonical courses (1-103) and unmapped courses
  const cleanedCourses = allCourses.filter(c => c.id <= 103 || unmappedCourses.some(u => u.id === c.id));
  
  console.log(`   Original: ${allCourses.length} courses`);
  console.log(`   Cleaned: ${cleanedCourses.length} courses`);
  
  if (!DRY_RUN) {
    // Backup original
    fs.copyFileSync(COURSES_CSV, COURSES_BACKUP);
    console.log(`   Backup saved to: courses_master_backup.csv`);
    
    // Write cleaned version
    const outputLines = ['id,title,description,ageRange,medium,sourceImage'];
    for (const c of cleanedCourses) {
      const escapedTitle = c.title.includes(',') ? `"${c.title}"` : c.title;
      outputLines.push(`${c.id},${escapedTitle},${c.description || ''},${c.ageRange || ''},${c.medium || ''},${c.sourceImage || ''}`);
    }
    fs.writeFileSync(COURSES_CSV, outputLines.join('\n') + '\n');
  }
  
  console.log('\n✅ Done!');
  
  if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run to apply changes');
  }
}

main().catch(console.error);
