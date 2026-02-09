/**
 * Parse OCR log files to extract source images for each course
 * and add a sourceImage column to courses_master.csv
 */

import * as fs from 'fs';
import * as path from 'path';

const LOG_FILES = [
  'ocr-log-gemini-vision-2026-02-07T15-27-27-724Z.txt',
  'ocr-log-gemini-vision-2026-02-07T17-22-46-798Z.txt',
  'ocr-log-gemini-vision-2026-02-07T19-32-24-526Z.txt',
  'ocr-log-gemini-vision-2026-02-07T21-30-06-636Z.txt',
  'ocr-log-gemini-vision-2026-02-08T08-36-27-008Z.txt',
];

const ROOT_DIR = path.resolve(__dirname, '../..');
const COURSES_CSV = path.join(ROOT_DIR, 'courses_master.csv');

interface CourseSource {
  courseId: number;
  title: string;
  sourceImage: string;
  year: string;
}

function parseLogFile(logPath: string): CourseSource[] {
  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.split('\n');
  
  const courses: CourseSource[] = [];
  let currentImage = '';
  let currentYear = '';
  
  for (const line of lines) {
    // Extract year from folder line: "📁 Folder: 2024" or "📅 Processing Year: 2024"
    const yearMatch = line.match(/(?:📁 Folder:|📅 Processing Year:)\s*(\d{4}(?:-\d{4})?)/);
    if (yearMatch) {
      currentYear = yearMatch[1];
    }
    
    // Extract current image being processed: "[1/296] Processing: IMG_6652.HEIC.jpg"
    const imageMatch = line.match(/\[\d+\/\d+\]\s*Processing:\s*(.+\.jpg)/i);
    if (imageMatch) {
      currentImage = imageMatch[1];
    }
    
    // Extract new course creation: "➕ Created new course: Pthon I → 881"
    const courseMatch = line.match(/➕\s*Created new course:\s*(.+?)\s*→\s*(\d+)/);
    if (courseMatch && currentImage) {
      courses.push({
        courseId: parseInt(courseMatch[2]),
        title: courseMatch[1],
        sourceImage: `${currentYear}/${currentImage}`,
        year: currentYear,
      });
    }
  }
  
  return courses;
}

function updateCoursesCSV(courseSourceMap: Map<number, CourseSource>): void {
  const content = fs.readFileSync(COURSES_CSV, 'utf-8');
  const lines = content.split('\n');
  
  // Parse header
  const header = lines[0];
  const hasSourceImage = header.includes('sourceImage');
  
  // Add sourceImage column to header if not present
  let newHeader = header.trim();
  if (!hasSourceImage) {
    // Remove trailing commas and add sourceImage
    newHeader = newHeader.replace(/,+$/, '') + ',sourceImage';
  }
  
  const outputLines = [newHeader];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse the course ID from the line
    const match = line.match(/^(\d+),/);
    if (!match) {
      // Keep line as-is but add empty sourceImage column
      outputLines.push(line.replace(/,+$/, '') + ',');
      continue;
    }
    
    const courseId = parseInt(match[1]);
    const source = courseSourceMap.get(courseId);
    
    // Remove trailing commas and add sourceImage
    const cleanLine = line.replace(/,+$/, '');
    if (source) {
      outputLines.push(`${cleanLine},${source.sourceImage}`);
    } else {
      outputLines.push(`${cleanLine},`);
    }
  }
  
  // Write back
  fs.writeFileSync(COURSES_CSV, outputLines.join('\n') + '\n');
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Add Source Images to Courses Master                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const courseSourceMap = new Map<number, CourseSource>();
  let totalFound = 0;
  
  for (const logFile of LOG_FILES) {
    const logPath = path.join(ROOT_DIR, logFile);
    
    if (!fs.existsSync(logPath)) {
      console.log(`⚠️  Log file not found: ${logFile}`);
      continue;
    }
    
    console.log(`📄 Parsing: ${logFile}`);
    const courses = parseLogFile(logPath);
    
    for (const course of courses) {
      // Only keep the first occurrence (original creation)
      if (!courseSourceMap.has(course.courseId)) {
        courseSourceMap.set(course.courseId, course);
      }
    }
    
    console.log(`   Found ${courses.length} course creations`);
    totalFound += courses.length;
  }
  
  console.log(`\n📊 Total course creations found: ${totalFound}`);
  console.log(`📊 Unique courses to update: ${courseSourceMap.size}`);
  
  // Update the CSV
  console.log(`\n📝 Updating: ${COURSES_CSV}`);
  updateCoursesCSV(courseSourceMap);
  
  console.log('\n✅ Done! courses_master.csv now has sourceImage column');
  
  // Show a sample
  console.log('\n📋 Sample mappings:');
  let count = 0;
  for (const [id, source] of courseSourceMap) {
    if (count >= 10) break;
    console.log(`   Course ${id}: ${source.title} → ${source.sourceImage}`);
    count++;
  }
}

main().catch(console.error);
