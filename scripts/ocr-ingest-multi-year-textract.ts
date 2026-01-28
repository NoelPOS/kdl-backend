/**
 * Multi-Year OCR Ingestion Script (AWS Textract Version)
 * 
 * This script uses AWS Textract instead of PaddleOCR for comparison purposes.
 * Outputs to ocr-output-textract/ to keep results separate from PaddleOCR results.
 * 
 * Directory structure expected:
 *   kdl-lms/
 *     2019/  <- HEIC images
 *     2020/  <- HEIC images
 *     ...
 * 
 * Output:
 *   kdl-lms/ocr-output-textract/
 *     2019/
 *       students.csv
 *       sessions.csv
 *       courses.csv
 *     ...
 * 
 * Usage:
 *   npx ts-node scripts/ocr-ingest-multi-year-textract.ts
 *   npx ts-node scripts/ocr-ingest-multi-year-textract.ts --folder 2019
 * 
 * Requirements:
 *   - AWS credentials configured in .env file (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)
 *   - AWS Textract permissions
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as heicConvert from 'heic-convert';
import { createObjectCsvWriter } from 'csv-writer';
import { parse } from 'csv-parse/sync';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import * as util from 'util';
import * as sharp from 'sharp';

// Configuration
const ROOT_DIR = path.join(__dirname, '../..');
const OUTPUT_BASE_DIR = path.join(ROOT_DIR, 'ocr-output-textract');
const LOG_FILE = path.join(ROOT_DIR, `ocr-log-textract-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);

const logFileStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Override console methods for convenience
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function log(...args: any[]) {
    const rawMsg = util.format(...args);
    originalConsoleLog(rawMsg);
    logFileStream.write(rawMsg + '\n');
}

function logError(...args: any[]) {
    const rawMsg = util.format(...args);
    originalConsoleError(rawMsg);
    logFileStream.write('[ERROR] ' + rawMsg + '\n');
}

console.log = log;
console.error = logError;

// Master courses file (shared across all years)
const MASTER_COURSES_CSV = path.join(ROOT_DIR, 'courses_master.csv');

// Initialize AWS Textract Client
const textractClient = new TextractClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    } : undefined
});

interface ExtractedData {
    sourceImage?: string;
    studentId?: string;
    studentName?: string;
    nickname?: string;
    school?: string;
    dob?: string;
    sex?: string;
    parentName?: string;
    mobile?: string;
    courseTitle?: string;
    teacherName?: string;
}

// Helper: Get all year folders
function getYearFolders(): string[] {
    const entries = fs.readdirSync(ROOT_DIR, { withFileTypes: true });
    return entries
        .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
        .map(entry => entry.name)
        .sort();
}

// Helper: Read existing CSV IDs
function readCsvIds(filePath: string, idColumn: string): Set<string> {
    if (!fs.existsSync(filePath)) return new Set();
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    return new Set(records.map((r: any) => r[idColumn]));
}

// Helper: Read courses
function readCourses(filePath: string): any[] {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    return parse(content, { columns: true, skip_empty_lines: true });
}

// Helper: Run AWS Textract OCR
async function runTextractOCR(imagePath: string): Promise<string> {
    try {
        // Read image file
        let imageBytes: Buffer = fs.readFileSync(imagePath);
        
        // Convert HEIC to JPEG if needed (Textract doesn't support HEIC)
        const ext = path.extname(imagePath).toLowerCase();
        if (ext === '.heic') {
            imageBytes = await sharp(imageBytes)
                .toFormat('jpeg')
                .toBuffer();
        }
        
        // Call AWS Textract
        const command = new DetectDocumentTextCommand({
            Document: { Bytes: imageBytes }
        });
        
        const response = await textractClient.send(command);
        
        // Extract text from LINE blocks
        if (!response.Blocks) {
            return '';
        }
        
        const lines = response.Blocks
            .filter(block => block.BlockType === 'LINE')
            .map(block => block.Text || '')
            .filter(text => text.length > 0);
        
        return lines.join('\n');
    } catch (error: any) {
        throw new Error(`Textract failed: ${error.message}`);
    }
}

// Helper: Check if string contains Thai characters
function containsThai(text: string): boolean {
    return /[\u0E00-\u0E7F]/.test(text);
}

// Helper: Validate student ID
function isValidStudentId(id: string): { valid: boolean; reason?: string } {
    if (!id || id.trim().length === 0) {
        return { valid: false, reason: 'Student ID too short or missing' };
    }
    
    // Should be 9-10 digits starting with year (20xx)
    const cleaned = id.replace(/\s/g, '');
    if (!/^20\d{7,8}$/.test(cleaned)) {
        return { valid: false, reason: `Invalid Student ID format: ${id} (should be 9-10 digits starting with year)` };
    }
    
    return { valid: true };
}

// Helper: Check if name is bad (OCR error patterns)
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
    
    // Check for Thai-word-caused OCR errors
    if (/^\.\w+\.\w+$/.test(name) || /^\.\w+$/.test(name)) return true;
    if (/^[a-z]+\d{2,}$/i.test(name) || /^[a-z]\d+$/i.test(name)) return true;
    
    return false;
}

// Helper: Clean phone number
function cleanPhone(phone: string): string {
    if (!phone) return '';
    return phone.replace(/\D/g, '').trim();
}

// Helper: Validate phone number
function isValidPhone(phone: string): { valid: boolean; reason?: string } {
    const cleaned = cleanPhone(phone);
    if (!cleaned) return { valid: true }; // Empty is OK
    
    // Thai phone numbers: 8-10 digits, starting with 0
    if (!/^0\d{7,9}$/.test(cleaned)) {
        return { valid: false, reason: `Invalid phone format: ${phone}` };
    }
    
    return { valid: true };
}

// Helper: Clean DOB
function cleanDob(dob: string): string {
    if (!dob) return '';
    // Try to normalize date formats
    return dob.trim();
}

// Helper: Validate data
function validateData(data: { dob?: string; phone?: string }): string[] {
    const warnings: string[] = [];
    
    if (data.dob && data.dob.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(data.dob)) {
        warnings.push(`Unusual DOB format: ${data.dob}`);
    }
    
    return warnings;
}

// Process single image with AWS Textract
async function processImage(filePath: string, jpgCacheFolder: string, knownCourses: any[]): Promise<ExtractedData | null> {
    console.log(`  Processing: ${path.basename(filePath)}`);
    
    let targetPath = filePath;
    let convertedFromHEIC = false;

    try {
        const ext = path.extname(filePath).toLowerCase();
        
        if (ext === '.heic') {
            // Create cached JPG path (same name, .jpg extension)
            const baseName = path.basename(filePath, '.heic');
            const cachedJpgPath = path.join(jpgCacheFolder, `${baseName}.jpg`);
            
            // Check if cached JPG already exists
            if (fs.existsSync(cachedJpgPath)) {
                console.log(`    ♻️  Using cached JPG`);
                targetPath = cachedJpgPath;
            } else {
                console.log(`    🔄 Converting HEIC to JPG...`);
                const fileBuffer = fs.readFileSync(filePath);
                const imageBytes = await heicConvert({
                    buffer: fileBuffer,
                    format: 'JPEG',
                    quality: 1
                });
                
                // Save to cache folder (permanent)
                fs.writeFileSync(cachedJpgPath, imageBytes);
                targetPath = cachedJpgPath;
                convertedFromHEIC = true;
                console.log(`    ✅ Saved JPG cache`);
            }
        }
    } catch (err: any) {
        console.error(`    ❌ Conversion error: ${err.message}`);
        return null;
    }

    // Run AWS Textract OCR
    let rawText = "";
    try {
        rawText = await runTextractOCR(targetPath);
        
        if (!rawText || rawText.trim().length === 0) {
            console.error(`    ❌ Textract returned no text`);
            return null;
        }
        
    } catch (err: any) {
        console.error(`    ❌ Textract failed: ${err.message}`);
        return null;
    }

    // Extract data with regex (same logic as PaddleOCR version)
    const data: ExtractedData = {
        sourceImage: path.basename(filePath)
    };

    // Robust ID matching:
    const idMatch = rawText.match(/Student ID\s*[:\.]?\s*([0-9oO\s]{4,})/i); 
    if (idMatch) {
         data.studentId = idMatch[1].replace(/[oO]/g, '0').replace(/\s/g, '');
    } else {
         if (/Student/i.test(rawText) && /ID/i.test(rawText)) {
              const potentialIds = rawText.match(/\b(20\d{7,})\b/g);
              if (potentialIds && potentialIds.length > 0) {
                   data.studentId = potentialIds[0];
                   console.log(`    ⚠️  Recovered ID via pattern search: ${data.studentId}`);
              }
         }
    }

    // Advanced Name Extraction with Multiple Fallback Strategies
    let nameMatch = rawText.match(/Student Name[:\s]+(.*?)(?=\s+(?:Nickname|Date|School|Sex[:\s]|Parent|Mobile|Teacher|Course|$))/i);
    if (nameMatch) {
        let extracted = nameMatch[1].trim();
        if (extracted && !/^(Male|Female|male|female)$/i.test(extracted)) {
            data.studentName = extracted;
        }
    } else {
        nameMatch = rawText.match(/Student Name[:\s]+([^\n\r]{1,100})/i);
        if (nameMatch) {
            let extracted = nameMatch[1].trim();
            extracted = extracted.replace(/\s*(?:Nickname|Date|School|Sex[:\s]|Parent|Mobile|Teacher|Course)[:\s].*$/i, '').trim();
            if (extracted.length > 0 && !/^(Male|Female|male|female)$/i.test(extracted)) {
                data.studentName = extracted;
            }
        } else {
            const lines = rawText.split('\n');
            const nameLabelIndex = lines.findIndex(line => /Student Name[:\s]*/i.test(line));
            if (nameLabelIndex >= 0 && nameLabelIndex < lines.length - 1) {
                let extracted = lines[nameLabelIndex + 1]?.trim() || '';
                extracted = extracted.replace(/\s*(?:Nickname|Date|School|Sex[:\s]|Parent|Mobile|Teacher|Course)[:\s].*$/i, '').trim();
                if (extracted.length > 0 && !/^(Male|Female|male|female)$/i.test(extracted)) {
                    data.studentName = extracted;
                }
            }
        }
    }

    // Nickname extraction
    let nickMatch = rawText.match(/Nickname[:\s]+(.*?)(?=\s+(?:Date|Sex|School|Parent|Mobile|Teacher|Student|Course|$))/i);
    if (nickMatch) {
        data.nickname = nickMatch[1].trim();
    } else {
        nickMatch = rawText.match(/Nickname[:\s]+([^\n\r]{1,50})/i);
        if (nickMatch) {
            data.nickname = nickMatch[1].trim();
        } else {
            const lines = rawText.split('\n');
            const nickLabelIndex = lines.findIndex(line => /Nickname[:\s]*/i.test(line));
            if (nickLabelIndex >= 0 && nickLabelIndex < lines.length - 1) {
                data.nickname = lines[nickLabelIndex + 1]?.trim() || '';
            }
        }
    }

    // School extraction
    let schoolMatch = rawText.match(/School[:\s]+(.*?)(?=\s+(?:Date|Sex|Parent|Mobile|Teacher|Student|Course|$))/i);
    if (schoolMatch) {
        data.school = schoolMatch[1].trim();
    } else {
        schoolMatch = rawText.match(/School[:\s]+([^\n\r]{1,100})/i);
        if (schoolMatch) {
            data.school = schoolMatch[1].trim();
        }
    }

    // DOB extraction
    const dobMatch = rawText.match(/Date of Birth[:\s]+(.*?)(?=\s+(?:Sex|Parent|Mobile|Teacher|$))/i);
    if (dobMatch) {
        data.dob = dobMatch[1].trim();
    }

    // Sex extraction
    const sexMatch = rawText.match(/Sex[:\s]+(Male|Female)/i);
    if (sexMatch) {
        data.sex = sexMatch[1];
    }

    // Parent name extraction
    let parentMatch = rawText.match(/Parent Name[:\s]+(.*?)(?=\s+(?:Mobile|Teacher|Course|Student|$))/i);
    if (parentMatch) {
        data.parentName = parentMatch[1].trim();
    } else {
        parentMatch = rawText.match(/Parent Name[:\s]+([^\n\r]{1,100})/i);
        if (parentMatch) {
            data.parentName = parentMatch[1].trim();
        } else {
            const lines = rawText.split('\n');
            const parentLabelIndex = lines.findIndex(line => /Parent Name[:\s]*/i.test(line));
            if (parentLabelIndex >= 0 && parentLabelIndex < lines.length - 1) {
                data.parentName = lines[parentLabelIndex + 1]?.trim() || '';
            }
        }
    }

    // Mobile extraction
    const mobileMatch = rawText.match(/Mobile[:\s]+([\d\s]+)/i);
    if (mobileMatch) {
        data.mobile = mobileMatch[1].trim();
    } else {
        const lines = rawText.split('\n');
        const mobileLabelIndex = lines.findIndex(line => /Mobile[:\s]*/i.test(line));
        if (mobileLabelIndex >= 0 && mobileLabelIndex < lines.length - 1) {
            const potentialMobile = lines[mobileLabelIndex + 1]?.trim() || '';
            if (/^\d[\d\s]{7,}$/.test(potentialMobile)) {
                data.mobile = potentialMobile;
            }
        }
    }

    // Course title extraction (same logic as PaddleOCR version)
    const coursePatterns = [
        /Course[:\s]+([^\n]{5,100})/i,
        /Course Title[:\s]+([^\n]{5,100})/i
    ];
    
    for (const regex of coursePatterns) {
        const match = rawText.match(regex);
        if (match) {
            data.courseTitle = match[1].trim();
            break;
        }
    }

    // If no course found, try fuzzy matching
    if (!data.courseTitle) {
        const lines = rawText.split('\n');
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('course') || lowerLine.includes('class')) {
                const courseMatch = line.match(/(?:course|class)[:\s]+(.+)/i);
                if (courseMatch) {
                    data.courseTitle = courseMatch[1].trim();
                    break;
                }
            }
        }
    }

    return data;
}

// Main processing function
async function main() {
    const args = process.argv.slice(2);
    const specificFolder = args.find(arg => arg.startsWith('--folder='))?.split('=')[1] || 
                          (args.includes('--folder') && args[args.indexOf('--folder') + 1]) || 
                          null;

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     Multi-Year OCR Ingestion Script (AWS Textract)          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // Check AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error('\n❌ AWS credentials not found!');
        console.error('Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.');
        console.error('You can also set AWS_REGION (defaults to us-east-1)');
        process.exit(1);
    }

    // Create output base directory
    if (!fs.existsSync(OUTPUT_BASE_DIR)) {
        fs.mkdirSync(OUTPUT_BASE_DIR, { recursive: true });
    }

    // Initialize master courses if doesn't exist
    if (!fs.existsSync(MASTER_COURSES_CSV)) {
        const existingCourses = path.join(ROOT_DIR, 'courses_2025.csv');
        if (fs.existsSync(existingCourses)) {
            fs.copyFileSync(existingCourses, MASTER_COURSES_CSV);
            console.log('✅ Initialized master courses from courses_2025.csv');
        }
    }

    let yearFolders: string[];
    
    if (specificFolder) {
        yearFolders = [specificFolder];
        console.log(`\n📁 Processing specific folder: ${specificFolder}`);
    } else {
        yearFolders = getYearFolders();
        console.log(`\n📁 Found ${yearFolders.length} year folders: ${yearFolders.join(', ')}`);
    }

    if (yearFolders.length === 0) {
        console.error('\n❌ No year folders found (format: YYYY)');
        console.log('Expected folders like: 2019, 2020, etc.');
        return;
    }

    // Process each year folder
    for (const yearFolder of yearFolders) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📅 Processing Year: ${yearFolder} (AWS Textract)`);
        console.log('='.repeat(60));

        const inputFolder = path.join(ROOT_DIR, yearFolder);
        const outputFolder = path.join(OUTPUT_BASE_DIR, yearFolder);
        const jpgCacheFolder = path.join(inputFolder, 'jpg-cache');

        if (!fs.existsSync(inputFolder)) {
            console.error(`❌ Input folder not found: ${inputFolder}`);
            continue;
        }

        // Create output folder
        if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
        }
        
        // Create JPG cache folder
        if (!fs.existsSync(jpgCacheFolder)) {
            fs.mkdirSync(jpgCacheFolder, { recursive: true });
        }

        // Output CSV paths
        const STUDENTS_CSV = path.join(outputFolder, 'students.csv');
        const PARENTS_CSV = path.join(outputFolder, 'parents.csv');
        const SESSIONS_CSV = path.join(outputFolder, 'sessions.csv');
        const FAILURES_CSV = path.join(outputFolder, 'failures.csv');

        // Clean start
        if (fs.existsSync(STUDENTS_CSV)) fs.unlinkSync(STUDENTS_CSV);
        if (fs.existsSync(PARENTS_CSV)) fs.unlinkSync(PARENTS_CSV);
        if (fs.existsSync(SESSIONS_CSV)) fs.unlinkSync(SESSIONS_CSV);
        if (fs.existsSync(FAILURES_CSV)) fs.unlinkSync(FAILURES_CSV);
        console.log(`🧹 Cleared old CSV files for ${yearFolder}`);
        
        const filesToProcess = fs.readdirSync(inputFolder)
            .filter(f => ['.jpg', '.jpeg', '.png', '.heic'].includes(path.extname(f).toLowerCase()));

        console.log(`📸 Queue: ${filesToProcess.length} images`);

        // Load existing data
        const existingStudentIds = readCsvIds(STUDENTS_CSV, 'studentId');
        const allCourses = readCourses(MASTER_COURSES_CSV);

        const newStudents: any[] = [];
        const newParents: any[] = [];
        const newParentNames = new Set<string>();
        const newSessions: any[] = [];
        const coursesToAppend: any[] = [];
        const failedImages: any[] = [];
        const warningImages: any[] = [];

        // Process Loop
        let processedCount = 0;
        for (const file of filesToProcess) {
            processedCount++;
            const progressPercent = Math.round((processedCount / filesToProcess.length) * 100);
            process.stdout.write(`\r[${processedCount}/${filesToProcess.length}] ${progressPercent}% `);

            const data = await processImage(path.join(inputFolder, file), jpgCacheFolder, allCourses);
            if (!data) {
                 failedImages.push({
                     file: file,
                     reason: 'Textract Extraction Failed (No data or AWS error)'
                 });
                 continue;
            }

            // Validate Student ID format
            const studentIdValidation = isValidStudentId(data.studentId || '');
            if (!studentIdValidation.valid) {
                console.warn(`\n    ⚠️  ${studentIdValidation.reason}`);
                failedImages.push({
                     file: file,
                     reason: studentIdValidation.reason || `Invalid Student ID: ${data.studentId}`
                 });
                continue;
            }

            // Check duplicate
            if (existingStudentIds.has(data.studentId!)) {
                console.log(`\n    ℹ️  Student ${data.studentId} already exists (checking for new sessions)`);
            }

            // Validate student name - WARNING only
            let studentNameWarning = null;
            if (isBadName(data.studentName || '')) {
                studentNameWarning = `Bad student name: "${data.studentName}" (OCR error or invalid format)`;
                console.warn(`\n    ⚠️  ${studentNameWarning}`);
                data.studentName = '';
            }

            // Clean phone number
            data.mobile = cleanPhone(data.mobile || '');
            data.dob = cleanDob(data.dob || '');

            // Validate phone number format - WARNING only
            let phoneWarning = null;
            if (data.mobile) {
                const phoneValidation = isValidPhone(data.mobile);
                if (!phoneValidation.valid) {
                    phoneWarning = phoneValidation.reason || `Invalid phone number: ${data.mobile}`;
                    console.warn(`\n    ⚠️  ${phoneWarning}`);
                    data.mobile = '';
                }
            }

            // Validate parent name - WARNING only
            let parentNameWarning = null;
            if (data.parentName && isBadName(data.parentName)) {
                parentNameWarning = `Bad parent name: "${data.parentName}" (OCR error or invalid format)`;
                console.warn(`\n    ⚠️  ${parentNameWarning}`);
                data.parentName = '';
            }

            // Detect Thai text - FAIL if detected
            const thaiDetections: string[] = [];
            if (data.studentName && containsThai(data.studentName)) {
                thaiDetections.push('Student name');
            }
            if (data.parentName && containsThai(data.parentName)) {
                thaiDetections.push('Parent name');
            }
            if (data.nickname && containsThai(data.nickname)) {
                thaiDetections.push('Nickname');
            }
            if (data.school && containsThai(data.school)) {
                thaiDetections.push('School');
            }
            if (data.courseTitle && containsThai(data.courseTitle)) {
                thaiDetections.push('Course title');
            }
            
            if (thaiDetections.length > 0) {
                const thaiFields = thaiDetections.join(', ');
                console.warn(`\n    ❌ Thai text detected in: ${thaiFields}`);
                failedImages.push({
                    file: file,
                    reason: `Thai text detected in: ${thaiFields} (OCR using English model cannot accurately process Thai text)`
                });
                continue;
            }
            
            // Collect all warnings
            const allWarnings: string[] = [];
            if (studentNameWarning) allWarnings.push(studentNameWarning);
            if (phoneWarning) allWarnings.push(phoneWarning);
            if (parentNameWarning) allWarnings.push(parentNameWarning);
            
            const validationWarnings = validateData({ dob: data.dob, phone: data.mobile });
            allWarnings.push(...validationWarnings);
            
            if (allWarnings.length > 0) {
                console.warn(`\n    ⚠️  Validation Warnings: ${allWarnings.join(', ')}`);
                warningImages.push({
                    file: file,
                    studentName: data.studentName || '(empty)',
                    studentId: data.studentId,
                    warnings: allWarnings
                });
            }

            // Only fail if we have NO valid student ID
            if (!data.studentId) {
                failedImages.push({
                    file: file,
                    reason: 'No valid Student ID extracted'
                });
                continue;
            }

            // Fail if we have NO student name AND NO course title (insufficient data)
            if (!data.studentName && !data.courseTitle) {
                failedImages.push({
                    file: file,
                    reason: 'No Student Name AND no Course Title extracted (insufficient data)'
                });
                continue;
            }

            // Save student (even with empty name if we have ID and course)
            if (!existingStudentIds.has(data.studentId)) {
                newStudents.push({
                    studentId: data.studentId,
                    name: data.studentName || '',
                    nickname: data.nickname || '',
                    nationalId: '',
                    dob: data.dob || '',
                    gender: data.sex || '',
                    school: data.school || '',
                    allergic: '',
                    doNotEat: '',
                    adConcent: 'FALSE',
                    phone: data.mobile || '',
                    sourceImage: data.sourceImage,
                    profilePicture: '',
                    profileKey: ''
                });
                existingStudentIds.add(data.studentId);
                console.log(`\n    ✅ Extracted: ${data.studentId} - ${data.studentName || '(no name)'}`);
            } else {
                console.log(`\n    ℹ️  Student ${data.studentId} already exists (checking for new sessions)`);
            }

            // Save parent (only if valid name)
            if (data.parentName && data.parentName.trim().length > 0 && !isBadName(data.parentName)) {
                const parentKey = `${data.parentName}|${data.mobile || ''}`;
                if (!newParentNames.has(parentKey)) {
                    newParents.push({
                        name: data.parentName,
                        contactNo: data.mobile || '',
                        sourceImage: data.sourceImage,
                        email: '',
                        lineId: '',
                        address: '',
                        profilePicture: '',
                        profileKey: ''
                    });
                    newParentNames.add(parentKey);
                    console.log(`    [+] Queued Parent: ${data.parentName}`);
                }
            }

            // Course matching and session creation (same logic as PaddleOCR version)
            if (data.courseTitle) {
                let matchedCourse = allCourses.find(c => 
                    c.title.toLowerCase() === data.courseTitle!.toLowerCase()
                );

                if (!matchedCourse) {
                    // Try fuzzy matching
                    matchedCourse = allCourses.find(c => {
                        const courseLower = c.title.toLowerCase();
                        const extractedLower = data.courseTitle!.toLowerCase();
                        return courseLower.includes(extractedLower) || extractedLower.includes(courseLower);
                    });
                    
                    if (matchedCourse) {
                        console.log(`    🔍 Fuzzy matched course: ${matchedCourse.title}`);
                    }
                }

                if (matchedCourse) {
                    newSessions.push({
                        studentId: data.studentId,
                        courseId: matchedCourse.id,
                        classOptionId: '1',
                        teacherId: '',
                        status: 'wip',
                        payment: 'Paid',
                        classCancel: '0',
                        sourceImage: data.sourceImage
                    });
                    console.log(`    📚 Matched course: ${matchedCourse.title} → ${matchedCourse.id}`);
                } else {
                    // Create new course
                    const newCourseId = String(100 + allCourses.length + coursesToAppend.length);
                    coursesToAppend.push({
                        id: newCourseId,
                        title: data.courseTitle,
                        description: '',
                        level: '',
                        duration: '',
                        price: '',
                        category: ''
                    });
                    allCourses.push({ id: newCourseId, title: data.courseTitle });
                    
                    newSessions.push({
                        studentId: data.studentId,
                        courseId: newCourseId,
                        classOptionId: '1',
                        teacherId: '',
                        status: 'wip',
                        payment: 'Paid',
                        classCancel: '0',
                        sourceImage: data.sourceImage
                    });
                    console.log(`    📚 Created new course: ${data.courseTitle} → ${newCourseId}`);
                }
            }
        }

        // Write CSVs
        if (newStudents.length > 0) {
            const writer = createObjectCsvWriter({
                path: STUDENTS_CSV,
                header: [
                    { id: 'studentId', title: 'studentId' },
                    { id: 'name', title: 'name' },
                    { id: 'nickname', title: 'nickname' },
                    { id: 'nationalId', title: 'nationalId' },
                    { id: 'dob', title: 'dob' },
                    { id: 'gender', title: 'gender' },
                    { id: 'school', title: 'school' },
                    { id: 'allergic', title: 'allergic' },
                    { id: 'doNotEat', title: 'doNotEat' },
                    { id: 'adConcent', title: 'adConcent' },
                    { id: 'phone', title: 'phone' },
                    { id: 'sourceImage', title: 'sourceImage' },
                    { id: 'profilePicture', title: 'profilePicture' },
                    { id: 'profileKey', title: 'profileKey' }
                ]
            });
            await writer.writeRecords(newStudents);
            console.log(`\n✅ Wrote ${newStudents.length} students to students.csv`);
        }

        if (newParents.length > 0) {
            const writer = createObjectCsvWriter({
                path: PARENTS_CSV,
                header: [
                    { id: 'name', title: 'name' },
                    { id: 'contactNo', title: 'contactNo' },
                    { id: 'sourceImage', title: 'sourceImage' },
                    { id: 'email', title: 'email' },
                    { id: 'lineId', title: 'lineId' },
                    { id: 'address', title: 'address' },
                    { id: 'profilePicture', title: 'profilePicture' },
                    { id: 'profileKey', title: 'profileKey' }
                ]
            });
            await writer.writeRecords(newParents);
            console.log(`✅ Wrote ${newParents.length} parents to parents.csv`);
        }

        if (newSessions.length > 0) {
            const writer = createObjectCsvWriter({
                path: SESSIONS_CSV,
                header: [
                    { id: 'studentId', title: 'studentId' },
                    { id: 'courseId', title: 'courseId' },
                    { id: 'classOptionId', title: 'classOptionId' },
                    { id: 'teacherId', title: 'teacherId' },
                    { id: 'status', title: 'status' },
                    { id: 'payment', title: 'payment' },
                    { id: 'classCancel', title: 'classCancel' },
                    { id: 'sourceImage', title: 'sourceImage' }
                ]
            });
            await writer.writeRecords(newSessions);
            console.log(`✅ Wrote ${newSessions.length} sessions to sessions.csv`);
        }

        if (coursesToAppend.length > 0) {
            const existingCourses = readCourses(MASTER_COURSES_CSV);
            const allCoursesCombined = [...existingCourses, ...coursesToAppend];
            const writer = createObjectCsvWriter({
                path: MASTER_COURSES_CSV,
                header: [
                    { id: 'id', title: 'id' },
                    { id: 'title', title: 'title' },
                    { id: 'description', title: 'description' },
                    { id: 'level', title: 'level' },
                    { id: 'duration', title: 'duration' },
                    { id: 'price', title: 'price' },
                    { id: 'category', title: 'category' }
                ]
            });
            await writer.writeRecords(allCoursesCombined);
            console.log(`✅ Added ${coursesToAppend.length} new courses to master list`);
        }

        if (failedImages.length > 0) {
            const writer = createObjectCsvWriter({
                path: FAILURES_CSV,
                header: [
                    { id: 'file', title: 'file' },
                    { id: 'reason', title: 'reason' }
                ]
            });
            await writer.writeRecords(failedImages);
            console.log(`\n❌ Wrote ${failedImages.length} failed images to failures.csv`);
        }

        console.log(`\n📊 Summary for ${yearFolder}:`);
        console.log(`   ✅ Students: ${newStudents.length}`);
        console.log(`   ✅ Parents: ${newParents.length}`);
        console.log(`   ✅ Sessions: ${newSessions.length}`);
        console.log(`   ✅ Courses added: ${coursesToAppend.length}`);
        console.log(`   ❌ Failures: ${failedImages.length}`);
        console.log(`   ⚠️  Warnings: ${warningImages.length}`);
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║            AWS Textract Processing Complete!                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`\n📁 Output location: ${OUTPUT_BASE_DIR}`);
    console.log(`📝 Log file: ${LOG_FILE}`);
}

main().catch(async (error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
