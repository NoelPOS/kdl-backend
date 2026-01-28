/**
 * Pre-Migration Data Cleanup Script
 * 
 * This script runs BEFORE migration to:
 * 1. Validate and clean student data (remove bad IDs, names, phones)
 * 2. Validate and clean parent data (remove bad names, phones)
 * 3. Deduplicate courses and update all sessions.csv files
 * 4. Move bad data to failures.csv for review
 * 
 * Usage:
 *   npx ts-node scripts/pre-migration-cleanup.ts --dry-run  (preview changes)
 *   npx ts-node scripts/pre-migration-cleanup.ts           (apply changes)
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { createObjectCsvWriter } from 'csv-writer';

const ROOT_DIR = path.join(__dirname, '../..');
const OCR_OUTPUT_DIR = path.join(ROOT_DIR, 'ocr-output');
const COURSES_MASTER = path.join(ROOT_DIR, 'courses_master.csv');

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

function isValidStudentId(studentId: string): { valid: boolean; reason?: string } {
    if (!studentId || studentId.length < 4) {
        return { valid: false, reason: 'Student ID too short or missing' };
    }
    
    // Check for invalid formats
    if (studentId.startsWith('22024')) {
        return { valid: false, reason: `Invalid format: ${studentId} (should start with 2024, not 22024)` };
    }
    
    // Check for extra digits (should be 9-10 digits total)
    if (/^20\d{7,9}$/.test(studentId)) {
        if (studentId.length > 10) {
            return { valid: false, reason: `Invalid format: ${studentId} (too long, has extra digits)` };
        }
        return { valid: true };
    }
    
    // Check if it's mostly digits but wrong format
    const digits = studentId.replace(/\D/g, '');
    if (digits.length >= 4 && digits.length <= 12) {
        return { valid: false, reason: `Invalid format: ${studentId} (should be 9-10 digits starting with year)` };
    }
    
    return { valid: false, reason: `Invalid format: ${studentId}` };
}

function isBadName(name: string): boolean {
    if (!name || name.length < 3) return true;
    const lower = name.toLowerCase();
    
    // Check for label leaks
    const labels = ['sex', 'sex:', 'mobile', 'mobile:', 'date of birth', 'parent', 'student', 'gender', 'gender:', 'name:', 'male', 'female'];
    if (labels.some(k => lower === k || lower.includes(k))) return true;

    // Check for "nonsense" extracted as names
    const badKeywords = ['school:', 'school', 'time:', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'date', 'note'];
    if (badKeywords.some(k => lower === k || lower.includes(k))) return true;

    // Check if it looks like a phone number or numeric only
    const digits = name.replace(/\D/g, '');
    if (digits.length > 6) return true;
    if (/^[\d\W]+$/.test(name)) return true;
    
    // Check for obvious OCR errors
    if (name.startsWith('..') || name === '..' || name.length < 2) return true;
    if (/^[A-Z]{1,2}$/.test(name) && name.length <= 2) return true;
    
    // Check for dates extracted as names
    if (/^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(name)) return true;
    if (/^\d{1,2}\s+Feb/i.test(name)) return true;
    
    // Check for very short single words that are likely OCR errors
    if (name.length <= 2 && !/^[A-Z][a-z]+$/.test(name)) return true;
    
    // Check for Thai-word-caused OCR errors (common patterns from misread Thai characters)
    // These patterns indicate OCR tried to read Thai but produced garbage:
    // - Names with dots and random letters: .y.s, .a.s, etc.
    // - Names with numbers mixed with letters: n5455, a5655, etc.
    // - Very short random letter combinations: nsasa, wlna, wuui, etc.
    // - Names that look like OCR tried to interpret Thai as Latin characters
    
    // Pattern 1: Dots with letters (e.g., .y.s, .a.s, .n.s)
    if (/^\.\w+\.\w+$/.test(name) || /^\.\w+$/.test(name)) return true;
    
    // Pattern 2: Numbers mixed with letters at start (e.g., n5455, a5655, k5, k55)
    if (/^[a-z]+\d{2,}$/i.test(name) || /^[a-z]\d+$/i.test(name)) return true;
    
    // Pattern 3: Very short random letter combinations (2-4 chars, no vowels, or all consonants)
    // Examples: nsasa, wlna, wuui, ns, un, a, etc.
    if (name.length <= 4) {
        // If it's all consonants or has very few vowels, likely OCR garbage
        const vowels = (name.match(/[aeiouAEIOU]/g) || []).length;
        const consonants = name.replace(/[^a-zA-Z]/g, '').length - vowels;
        if (vowels === 0 || (consonants > vowels * 2 && name.length <= 4)) {
            // Exception: Allow common short names like "Ali", "Amy", "Ian", "Max", "Leo"
            const commonShortNames = ['ali', 'amy', 'ian', 'max', 'leo', 'jay', 'kim', 'ray', 'roy', 'tom', 'tim', 'sam', 'dan', 'ben', 'joe', 'ted', 'hal', 'pat', 'lee', 'kai', 'rio', 'rio', 'noa', 'eva', 'ava', 'mia', 'zoe', 'liz', 'ann', 'may', 'joy', 'sue', 'meg', 'pam', 'jan', 'jim', 'bob', 'rob', 'don', 'ron', 'ken', 'len', 'ned', 'rex', 'tad', 'van', 'wes', 'zac'];
            if (!commonShortNames.includes(lower)) {
                return true;
            }
        }
    }
    
    // Pattern 4: Names that are mostly non-alphabetic characters or weird combinations
    // Examples: sawsanna (partial), nsasa, wlna, wuui
    if (/^[a-z]{2,6}$/i.test(name)) {
        // Check if it looks like random letter combinations (no common name patterns)
        // Very short names with unusual letter combinations
        if (name.length <= 5 && !/[aeiouAEIOU]{2,}/.test(name) && !commonShortNames.includes(lower)) {
            // Allow if it has at least 2 vowels or is a known short name
            const vowelCount = (name.match(/[aeiouAEIOU]/g) || []).length;
            if (vowelCount < 2) {
                return true;
            }
        }
    }
    
    return false;
}

function isValidPhone(phone: string): { valid: boolean; reason?: string } {
    if (!phone) return { valid: true }; // Empty phone is OK
    
    // Thai mobile: should be 10 digits, starting with 0
    if (phone.length !== 10) {
        return { valid: false, reason: `Invalid length: ${phone.length} digits (should be 10)` };
    }
    
    if (!phone.startsWith('0')) {
        return { valid: false, reason: `Invalid format: ${phone} (should start with 0)` };
    }
    
    if (!/^\d{10}$/.test(phone)) {
        return { valid: false, reason: `Invalid format: ${phone} (should be 10 digits)` };
    }
    
    return { valid: true };
}

// =============================================================================
// COURSE DEDUPLICATION
// =============================================================================

function normalizeCourseName(title: string): string {
    if (!title) return '';
    
    // Remove "Course:" prefix and normalize spacing
    let normalized = title.replace(/^Course\s*:?\s*/i, '').trim();
    
    // Fix common typos
    normalized = normalized.replace(/Intermedaite/gi, 'Intermediate');
    normalized = normalized.replace(/Begonner/gi, 'Beginner');
    normalized = normalized.replace(/Begineer/gi, 'Beginner');
    normalized = normalized.replace(/TInkamo/gi, 'Tinkamo');
    normalized = normalized.replace(/TInkerer/gi, 'Tinkerer');
    normalized = normalized.replace(/mTIny/gi, 'mTiny');
    normalized = normalized.replace(/Tiunkamo/gi, 'Tinkamo');
    normalized = normalized.replace(/Animationa/gi, 'Animation');
    normalized = normalized.replace(/Aniimation/gi, 'Animation');
    normalized = normalized.replace(/Gane/gi, 'Game');
    normalized = normalized.replace(/Crerator/gi, 'Creator');
    normalized = normalized.replace(/Rody/gi, 'Rocky');
    normalized = normalized.replace(/Pthon/gi, 'Python');
    normalized = normalized.replace(/Aruduino/gi, 'Arduino');
    normalized = normalized.replace(/Pygtme/gi, 'Pygame');
    normalized = normalized.replace(/Full Stax/gi, 'Full Stack');
    
    // Normalize spacing around punctuation
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
}

function findDuplicateCourses(courses: any[]): Map<number, number> {
    // Map: oldCourseId -> newCourseId (for merging)
    const courseMap = new Map<number, number>();
    
    // Group courses by normalized name
    const normalizedGroups = new Map<string, number[]>();
    
    for (const course of courses) {
        const normalized = normalizeCourseName(course.title);
        if (!normalizedGroups.has(normalized)) {
            normalizedGroups.set(normalized, []);
        }
        normalizedGroups.get(normalized)!.push(parseInt(course.id));
    }
    
    // For each group with multiple courses, keep the lowest ID
    for (const [normalized, ids] of normalizedGroups.entries()) {
        if (ids.length > 1) {
            ids.sort((a, b) => a - b);
            const keepId = ids[0]; // Keep the first/lowest ID
            for (let i = 1; i < ids.length; i++) {
                courseMap.set(ids[i], keepId);
            }
        }
    }
    
    return courseMap;
}

// =============================================================================
// MAIN CLEANUP FUNCTION
// =============================================================================

async function cleanupAllYears(isDryRun: boolean) {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║          Pre-Migration Data Cleanup Script                    ║');
    if (isDryRun) console.log('║          MODE: DRY RUN (Preview Only)                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    
    if (!fs.existsSync(OCR_OUTPUT_DIR)) {
        console.error('❌ OCR output directory not found:', OCR_OUTPUT_DIR);
        return;
    }
    
    // Get all year folders
    const yearFolders = fs.readdirSync(OCR_OUTPUT_DIR, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort();
    
    console.log(`\n📁 Found ${yearFolders.length} year folders: ${yearFolders.join(', ')}`);
    
    // Step 1: Clean courses_master.csv and create mapping
    console.log('\n' + '='.repeat(60));
    console.log('📚 Step 1: Deduplicating Courses');
    console.log('='.repeat(60));
    
    if (!fs.existsSync(COURSES_MASTER)) {
        console.error('❌ courses_master.csv not found');
        return;
    }
    
    const coursesContent = fs.readFileSync(COURSES_MASTER, 'utf-8');
    const courses = parse(coursesContent, { columns: true, skip_empty_lines: true });
    console.log(`   Loaded ${courses.length} courses from courses_master.csv`);
    
    const courseMapping = findDuplicateCourses(courses);
    console.log(`   Found ${courseMapping.size} duplicate courses to merge`);
    
    if (courseMapping.size > 0) {
        console.log('\n   Course Merges:');
        for (const [oldId, newId] of courseMapping.entries()) {
            const oldCourse = courses.find(c => parseInt(c.id) === oldId);
            const newCourse = courses.find(c => parseInt(c.id) === newId);
            console.log(`     ${oldId} → ${newId}: "${oldCourse?.title}" → "${newCourse?.title}"`);
        }
    }
    
    // Step 2: Process each year folder
    const allFailures: Array<{ year: string; file: string; reason: string; type: string }> = [];
    let totalStudentsRemoved = 0;
    let totalParentsRemoved = 0;
    let totalSessionsUpdated = 0;
    
    for (const yearFolder of yearFolders) {
        console.log('\n' + '='.repeat(60));
        console.log(`📅 Processing Year: ${yearFolder}`);
        console.log('='.repeat(60));
        
        const yearDir = path.join(OCR_OUTPUT_DIR, yearFolder);
        const studentsFile = path.join(yearDir, 'students.csv');
        const parentsFile = path.join(yearDir, 'parents.csv');
        const sessionsFile = path.join(yearDir, 'sessions.csv');
        const failuresFile = path.join(yearDir, 'failures.csv');
        
        // Load existing failures
        const existingFailures: Array<{ file: string; reason: string }> = [];
        if (fs.existsSync(failuresFile)) {
            const failuresContent = fs.readFileSync(failuresFile, 'utf-8');
            const failures = parse(failuresContent, { columns: true, skip_empty_lines: true });
            existingFailures.push(...failures);
        }
        
        // Process Students
        const removedStudentIds = new Set<string>(); // Track removed student IDs for session cleanup
        if (fs.existsSync(studentsFile)) {
            console.log(`\n👨‍🎓 Processing students...`);
            const studentsContent = fs.readFileSync(studentsFile, 'utf-8');
            const students = parse(studentsContent, { columns: true, skip_empty_lines: true });
            
            const validStudents: any[] = [];
            let removed = 0;
            
            for (const student of students) {
                const issues: string[] = [];
                
                // Validate Student ID
                const idValidation = isValidStudentId(student.studentId || '');
                if (!idValidation.valid) {
                    issues.push(idValidation.reason || 'Invalid Student ID');
                }
                
                // Validate Student Name
                if (isBadName(student.name || '')) {
                    issues.push(`Bad student name: "${student.name}" (likely Thai-word-caused OCR error)`);
                }
                
                // Validate Phone
                if (student.phone) {
                    const phoneValidation = isValidPhone(student.phone);
                    if (!phoneValidation.valid) {
                        issues.push(phoneValidation.reason || 'Invalid phone');
                    }
                }
                
                if (issues.length > 0) {
                    const reason = issues.join('; ');
                    allFailures.push({
                        year: yearFolder,
                        file: student.sourceImage || 'unknown',
                        reason: reason,
                        type: 'student'
                    });
                    existingFailures.push({
                        file: student.sourceImage || 'unknown',
                        reason: reason
                    });
                    // Track removed student ID for session cleanup
                    if (student.studentId) {
                        removedStudentIds.add(student.studentId);
                    }
                    removed++;
                    console.log(`   ❌ Removed: ${student.studentId} - ${student.name} (${reason})`);
                } else {
                    validStudents.push(student);
                }
            }
            
            console.log(`   ✅ Kept ${validStudents.length} students, removed ${removed}`);
            totalStudentsRemoved += removed;
            
            if (!isDryRun && validStudents.length > 0) {
                const writer = createObjectCsvWriter({
                    path: studentsFile,
                    header: Object.keys(validStudents[0]).map(key => ({ id: key, title: key }))
                });
                await writer.writeRecords(validStudents);
            }
        }
        
        // Process Parents
        if (fs.existsSync(parentsFile)) {
            console.log(`\n👨‍👩‍👧 Processing parents...`);
            const parentsContent = fs.readFileSync(parentsFile, 'utf-8');
            const parents = parse(parentsContent, { columns: true, skip_empty_lines: true });
            
            const validParents: any[] = [];
            let removed = 0;
            
            for (const parent of parents) {
                const issues: string[] = [];
                
                // Validate Parent Name
                if (isBadName(parent.name || '')) {
                    issues.push(`Bad parent name: "${parent.name}"`);
                }
                
                // Validate Phone
                if (parent.contactNo) {
                    const phoneValidation = isValidPhone(parent.contactNo);
                    if (!phoneValidation.valid) {
                        issues.push(phoneValidation.reason || 'Invalid phone');
                    }
                }
                
                if (issues.length > 0) {
                    const reason = issues.join('; ');
                    allFailures.push({
                        year: yearFolder,
                        file: parent.sourceImage || 'unknown',
                        reason: reason,
                        type: 'parent'
                    });
                    existingFailures.push({
                        file: parent.sourceImage || 'unknown',
                        reason: reason
                    });
                    removed++;
                    console.log(`   ❌ Removed: ${parent.name} (${reason})`);
                } else {
                    validParents.push(parent);
                }
            }
            
            console.log(`   ✅ Kept ${validParents.length} parents, removed ${removed}`);
            totalParentsRemoved += removed;
            
            if (!isDryRun && validParents.length > 0) {
                const writer = createObjectCsvWriter({
                    path: parentsFile,
                    header: Object.keys(validParents[0]).map(key => ({ id: key, title: key }))
                });
                await writer.writeRecords(validParents);
            }
        }
        
        // Process Sessions (remove orphaned sessions and update courseId references)
        if (fs.existsSync(sessionsFile)) {
            console.log(`\n📚 Processing sessions...`);
            const sessionsContent = fs.readFileSync(sessionsFile, 'utf-8');
            const sessions = parse(sessionsContent, { columns: true, skip_empty_lines: true });
            
            // Get valid student IDs (from students that passed validation)
            const validStudentIds = new Set<string>();
            if (fs.existsSync(studentsFile)) {
                const studentsContent = fs.readFileSync(studentsFile, 'utf-8');
                const students = parse(studentsContent, { columns: true, skip_empty_lines: true });
                // Re-validate to get the actual valid set
                for (const student of students) {
                    const idValidation = isValidStudentId(student.studentId || '');
                    const nameValidation = !isBadName(student.name || '');
                    if (idValidation.valid && nameValidation) {
                        validStudentIds.add(student.studentId);
                    }
                }
            }
            
            const validSessions: any[] = [];
            let removed = 0;
            let updated = 0;
            
            for (const session of sessions) {
                // Remove sessions for students that were removed (bad names, invalid IDs, etc.)
                if (removedStudentIds.has(session.studentId)) {
                    // Add to failures
                    allFailures.push({
                        year: yearFolder,
                        file: session.sourceImage || 'unknown',
                        reason: `Session removed: Student ${session.studentId} was removed due to bad data`,
                        type: 'session'
                    });
                    existingFailures.push({
                        file: session.sourceImage || 'unknown',
                        reason: `Session removed: Student ${session.studentId} was removed due to bad data`
                    });
                    removed++;
                    continue;
                }
                
                // Validate that student ID exists in valid students
                if (!validStudentIds.has(session.studentId)) {
                    // Orphaned session (student doesn't exist or was removed)
                    allFailures.push({
                        year: yearFolder,
                        file: session.sourceImage || 'unknown',
                        reason: `Session removed: Student ${session.studentId} not found or invalid`,
                        type: 'session'
                    });
                    existingFailures.push({
                        file: session.sourceImage || 'unknown',
                        reason: `Session removed: Student ${session.studentId} not found or invalid`
                    });
                    removed++;
                    continue;
                }
                
                // Check if course ID needs to be updated (due to deduplication)
                const oldCourseId = parseInt(session.courseId);
                if (courseMapping.has(oldCourseId)) {
                    session.courseId = String(courseMapping.get(oldCourseId));
                    updated++;
                }
                
                validSessions.push(session);
            }
            
            console.log(`   ✅ Kept ${validSessions.length} sessions, removed ${removed} (orphaned/removed), updated ${updated} course IDs`);
            totalSessionsUpdated += updated;
            
            if (!isDryRun && validSessions.length > 0) {
                const writer = createObjectCsvWriter({
                    path: sessionsFile,
                    header: Object.keys(validSessions[0]).map(key => ({ id: key, title: key }))
                });
                await writer.writeRecords(validSessions);
            }
            
            if (!isDryRun && updated > 0) {
                const writer = createObjectCsvWriter({
                    path: sessionsFile,
                    header: Object.keys(sessions[0]).map(key => ({ id: key, title: key }))
                });
                await writer.writeRecords(sessions);
            }
        }
        
        // Write failures
        if (existingFailures.length > 0) {
            if (!isDryRun) {
                const writer = createObjectCsvWriter({
                    path: failuresFile,
                    header: [
                        { id: 'file', title: 'file' },
                        { id: 'reason', title: 'reason' }
                    ]
                });
                await writer.writeRecords(existingFailures);
            }
            console.log(`   📝 ${existingFailures.length} failures recorded`);
        }
    }
    
    // Step 3: Clean courses_master.csv
    if (courseMapping.size > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('📚 Step 3: Cleaning courses_master.csv');
        console.log('='.repeat(60));
        
        const idsToRemove = new Set(courseMapping.keys());
        const cleanedCourses = courses.filter(c => !idsToRemove.has(parseInt(c.id)));
        
        console.log(`   Removed ${courseMapping.size} duplicate courses`);
        console.log(`   Kept ${cleanedCourses.length} unique courses`);
        
        if (!isDryRun) {
            const writer = createObjectCsvWriter({
                path: COURSES_MASTER,
                header: [
                    { id: 'id', title: 'id' },
                    { id: 'title', title: 'title' },
                    { id: 'description', title: 'description' },
                    { id: 'ageRange', title: 'ageRange' },
                    { id: 'medium', title: 'medium' }
                ]
            });
            await writer.writeRecords(cleanedCourses);
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Cleanup Summary');
    console.log('='.repeat(60));
    console.log(`   Students removed: ${totalStudentsRemoved}`);
    console.log(`   Parents removed: ${totalParentsRemoved}`);
    console.log(`   Courses deduplicated: ${courseMapping.size}`);
    console.log(`   Sessions updated: ${totalSessionsUpdated}`);
    console.log(`   Total failures: ${allFailures.length}`);
    
    if (isDryRun) {
        console.log('\n✅ Dry run complete. Run without --dry-run to apply changes.');
    } else {
        console.log('\n✅ Cleanup complete! Data is ready for migration.');
    }
}

// Main
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

cleanupAllYears(isDryRun).catch(error => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
});
