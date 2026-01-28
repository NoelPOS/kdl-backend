/**
 * Multi-Year OCR Ingestion Script
 * 
 * Processes HEIC images from multiple year folders and generates CSVs organized by year
 * 
 * Directory structure expected:
 *   kdl-lms/
 *     2019-2020/  <- HEIC images
 *     2021-2022/  <- HEIC images
 *     2023-2024/  <- HEIC images
 * 
 * Output:
 *   kdl-lms/ocr-output/
 *     2019-2020/
 *       students.csv
 *       sessions.csv
 *       courses.csv
 *     2021-2022/
 *       ...
 * 
 * Usage:
 *   npx ts-node scripts/ocr-ingest-multi-year.ts
 *   npx ts-node scripts/ocr-ingest-multi-year.ts --folder 2019-2020  (process specific folder)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as heicConvert from 'heic-convert';
import { createObjectCsvWriter } from 'csv-writer';
import { parse } from 'csv-parse/sync';
import { spawn } from 'child_process';
import * as util from 'util';

// Configuration
const ROOT_DIR = path.join(__dirname, '../..');
const OUTPUT_BASE_DIR = path.join(ROOT_DIR, 'ocr-output');
const LOG_FILE = path.join(ROOT_DIR, `ocr-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);

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
const PYTHON_SCRIPT = path.join(__dirname, '../ocr-service/main.py');
const PYTHON_WORKER = path.join(__dirname, '../ocr-service/worker.py');
const PYTHON_EXE = path.join(__dirname, '../ocr-service/venv/Scripts/python.exe');

// Master courses file (shared across all years)
const MASTER_COURSES_CSV = path.join(ROOT_DIR, 'courses_master.csv');

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
        .filter(entry => entry.isDirectory() && /^\d{4}(-\d{4})?$/.test(entry.name))
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

// Persistent OCR Worker Manager
class OCRWorker {
    private process: any = null;
    private isReady: boolean = false;
    private pendingResolves: Map<number, { resolve: (value: string) => void; reject: (error: Error) => void }> = new Map();
    private requestId: number = 0;
    private buffer: string = '';

    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log('🚀 Starting persistent OCR worker...');
            
            this.process = spawn(PYTHON_EXE, [PYTHON_WORKER], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let initTimeout: NodeJS.Timeout;
            let errorBuffer = '';

            // Wait for worker to be ready
            this.process.stderr.on('data', (data: Buffer) => {
                const text = data.toString();
                errorBuffer += text;
                // Forward stderr to console for debugging
                process.stdout.write(text);
                
                // Check if worker is ready
                if (text.includes('[Worker] Ready!')) {
                    this.isReady = true;
                    clearTimeout(initTimeout);
                    console.log('✅ OCR worker ready!');
                    resolve();
                }
            });

            this.process.stdout.on('data', (data: Buffer) => {
                this.buffer += data.toString();
                this.processBuffer();
            });

            this.process.on('error', (error: Error) => {
                clearTimeout(initTimeout);
                reject(new Error(`Failed to start OCR worker: ${error.message}`));
            });

            this.process.on('exit', (code: number) => {
                if (code !== 0 && code !== null && this.isReady) {
                    const error = new Error(`OCR worker crashed with code ${code}`);
                    // Reject all pending requests
                    this.pendingResolves.forEach(({ reject }) => reject(error));
                    this.pendingResolves.clear();
                    this.isReady = false;
                }
            });

            // Timeout if worker doesn't initialize within 30 seconds
            initTimeout = setTimeout(() => {
                if (!this.isReady) {
                    this.process?.kill();
                    reject(new Error('OCR worker initialization timeout (30s)'));
                }
            }, 30000);
        });
    }

    private processBuffer(): void {
        // Process complete JSON lines (one per line)
        const lines = this.buffer.split('\n');
        // Keep the last incomplete line in buffer
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
                const result = JSON.parse(line);
                // Find the oldest pending request
                const firstKey = Array.from(this.pendingResolves.keys())[0];
                if (firstKey !== undefined) {
                    const { resolve } = this.pendingResolves.get(firstKey)!;
                    this.pendingResolves.delete(firstKey);
                    resolve(JSON.stringify(result));
                }
            } catch (e) {
                // Invalid JSON, might be partial - keep in buffer
                this.buffer = line + '\n' + this.buffer;
            }
        }
    }

    async processImage(imagePath: string, isExhaustive: boolean = false): Promise<string> {
        if (!this.isReady || !this.process) {
            throw new Error('OCR worker not started');
        }

        return new Promise((resolve, reject) => {
            const id = this.requestId++;
            this.pendingResolves.set(id, { resolve, reject });

            // Send image path to worker
            const input = imagePath + (isExhaustive ? ' --exhaustive' : '') + '\n';
            this.process.stdin.write(input, (err: Error | null) => {
                if (err) {
                    this.pendingResolves.delete(id);
                    reject(err);
                }
            });

            // Timeout after 60 seconds
            setTimeout(() => {
                if (this.pendingResolves.has(id)) {
                    this.pendingResolves.delete(id);
                    reject(new Error(`OCR timeout for ${imagePath}`));
                }
            }, 60000);
        });
    }

    async stop(): Promise<void> {
        if (this.process) {
            return new Promise((resolve) => {
                this.process.stdin.end();
                this.process.on('exit', () => {
                    console.log('🛑 OCR worker stopped');
                    resolve();
                });
                // Force kill after 5 seconds if it doesn't exit gracefully
                setTimeout(() => {
                    if (this.process && !this.process.killed) {
                        this.process.kill();
                    }
                    resolve();
                }, 5000);
            });
        }
    }
}

// Global worker instance
let ocrWorker: OCRWorker | null = null;

// Helper: Run Python OCR (now uses persistent worker)
async function runPythonOCR(imagePath: string, isExhaustive: boolean = false): Promise<string> {
    if (!ocrWorker) {
        throw new Error('OCR worker not initialized. Call startOCRWorker() first.');
    }
    return ocrWorker.processImage(imagePath, isExhaustive);
}

// Initialize OCR worker
async function startOCRWorker(): Promise<void> {
    ocrWorker = new OCRWorker();
    await ocrWorker.start();
}

// Cleanup OCR worker
async function stopOCRWorker(): Promise<void> {
    if (ocrWorker) {
        await ocrWorker.stop();
        ocrWorker = null;
    }
}

// Core: Process single image
async function processImage(filePath: string, jpgCacheFolder: string, knownCourses: any[], isExhaustive: boolean = false): Promise<ExtractedData | null> {
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

    // Run OCR
    let rawText = "";
    try {
        const jsonResult = await runPythonOCR(targetPath, isExhaustive);
        const parsedResult = JSON.parse(jsonResult);
        
        if (parsedResult.error) {
            console.error(`    ❌ OCR Error: ${parsedResult.error}`);
            return null;
        }

        rawText = parsedResult.map((item: any) => item.text).join('\n');
        
    } catch (err: any) {
        console.error(`    ❌ OCR failed: ${err.message}`);
        return null;
    }

    // Extract data with regex
    const data: ExtractedData = {
        sourceImage: path.basename(filePath)
    };

    // Robust ID matching:
    // 1. Standard same-line match (allow 'O'/'o' as digit 0, allow missing colon)
    const idMatch = rawText.match(/Student ID\s*[:\.]?\s*([0-9oO\s]{4,})/i); 
    if (idMatch) {
         data.studentId = idMatch[1].replace(/[oO]/g, '0').replace(/\s/g, ''); // Fix 0/O and spaces
    } else {
         // 2. Multiline fallback: Look for "Student ID" line, then check the NEXT line or nearby text
         // This is harder with raw text joined by newline, but often it's "Student ID: \n 2021..."
         // Let's try to find just a 9+ digit number near the top if "Student ID" keyword exists
         if (/Student/i.test(rawText) && /ID/i.test(rawText)) {
              const potentialIds = rawText.match(/\b(20\d{7,})\b/g); // Look for 20xxxxxxx pattern
              if (potentialIds && potentialIds.length > 0) {
                   data.studentId = potentialIds[0];
                   console.log(`    ⚠️  Recovered ID via pattern search: ${data.studentId}`);
              }
         }
    }

    // Advanced Name Extraction with Multiple Fallback Strategies
    // Strategy 1: Standard pattern with lookahead (most precise)
    // IMPORTANT: Must stop BEFORE "Sex" field to avoid capturing "Male"/"Female" as names
    let nameMatch = rawText.match(/Student Name[:\s]+(.*?)(?=\s+(?:Nickname|Date|School|Sex[:\s]|Parent|Mobile|Teacher|Course|$))/i);
    if (nameMatch) {
        let extracted = nameMatch[1].trim();
        // Critical: Reject if extracted value is just "Male" or "Female" (these are Sex values, not names)
        if (extracted && !/^(Male|Female|male|female)$/i.test(extracted)) {
            data.studentName = extracted;
        }
    } else {
        // Strategy 2: Match until newline (handles rotated/malformed text)
        nameMatch = rawText.match(/Student Name[:\s]+([^\n\r]{1,100})/i);
        if (nameMatch) {
            let extracted = nameMatch[1].trim();
            // Clean up: remove common field labels that might have leaked
            extracted = extracted.replace(/\s*(?:Nickname|Date|School|Sex[:\s]|Parent|Mobile|Teacher|Course)[:\s].*$/i, '').trim();
            // Critical: Reject if extracted value is just "Male" or "Female"
            if (extracted.length > 0 && !/^(Male|Female|male|female)$/i.test(extracted)) {
                data.studentName = extracted;
            }
        }
    }
    
    // Strategy 3: Positional extraction - if "Student Name:" exists, get text from next line
    if (!data.studentName || data.studentName.length < 2) {
        const lines = rawText.split('\n');
        const nameLabelIndex = lines.findIndex(line => /Student Name[:\s]*/i.test(line));
        if (nameLabelIndex >= 0 && nameLabelIndex < lines.length - 1) {
            // Check next 2 lines for potential name
            for (let i = 1; i <= 2; i++) {
                const candidate = lines[nameLabelIndex + i]?.trim();
                if (candidate && candidate.length >= 2 && candidate.length <= 100) {
                    // Critical: Reject "Male"/"Female" (these are Sex values)
                    if (/^(Male|Female|male|female)$/i.test(candidate)) {
                        continue; // Skip this candidate
                    }
                    // Quick validation: not a field label, not mostly numbers
                    const digits = candidate.replace(/\D/g, '').length;
                    if (digits < candidate.length * 0.5 && !/^(Nickname|Date|School|Sex|Parent|Mobile|Teacher|Course)/i.test(candidate)) {
                        data.studentName = candidate;
                        break;
                    }
                }
            }
        }
    }
    
    // Strategy 4: Extract from structured format (if OCR detected structure)
    if (!data.studentName || data.studentName.length < 2) {
        // Look for pattern: "Student ID: XXXX\nStudent Name: YYYY"
        const structuredMatch = rawText.match(/Student\s+ID[:\s]+[^\n]+\n[^\n]*Student\s+Name[:\s]+([^\n]{2,100})/i);
        if (structuredMatch) {
            const extracted = structuredMatch[1].trim();
            // Critical: Reject "Male"/"Female" (these are Sex values)
            if (extracted && !/^(Male|Female|male|female)$/i.test(extracted)) {
                data.studentName = extracted;
            }
        }
    }
    
    // Final validation: If name is "Male" or "Female", clear it (it's a Sex value, not a name)
    if (data.studentName && /^(Male|Female|male|female)$/i.test(data.studentName.trim())) {
        data.studentName = ''; // Clear invalid name
    }

    // Advanced Nickname Extraction with Multiple Fallback Strategies
    // Strategy 1: Standard pattern with lookahead (most precise)
    let nickMatch = rawText.match(/Nickname[:\s]+(.*?)(?=\s+(?:Date|Sex|School|Parent|Mobile|Teacher|Student|Course|$))/i);
    if (nickMatch) {
        let extracted = nickMatch[1].trim();
        // Clean up: remove common field labels that might have leaked
        extracted = extracted.replace(/\s*(?:Date|Sex|School|Parent|Mobile|Teacher|Student|Course)[:\s].*$/i, '').trim();
        if (extracted.length > 0 && extracted.length <= 50) {
            data.nickname = extracted;
        }
    } else {
        // Strategy 2: Match until newline (handles rotated/malformed text)
        nickMatch = rawText.match(/Nickname[:\s]+([^\n\r]{1,50})/i);
        if (nickMatch) {
            let extracted = nickMatch[1].trim();
            // Clean up: remove common field labels that might have leaked
            extracted = extracted.replace(/\s*(?:Date|Sex|School|Parent|Mobile|Teacher|Student|Course)[:\s].*$/i, '').trim();
            if (extracted.length > 0 && extracted.length <= 50) {
                data.nickname = extracted;
            }
        }
    }
    
    // Strategy 3: Positional extraction - if "Nickname:" exists, get text from next line
    if (!data.nickname || data.nickname.length < 1) {
        const lines = rawText.split('\n');
        const nickLabelIndex = lines.findIndex(line => /Nickname[:\s]*/i.test(line));
        if (nickLabelIndex >= 0 && nickLabelIndex < lines.length - 1) {
            // Check next 2 lines for potential nickname
            for (let i = 1; i <= 2; i++) {
                const candidate = lines[nickLabelIndex + i]?.trim();
                if (candidate && candidate.length >= 1 && candidate.length <= 50) {
                    // Quick validation: not a field label, not mostly numbers
                    const digits = candidate.replace(/\D/g, '').length;
                    if (digits < candidate.length * 0.7 && !/^(Date|Sex|School|Parent|Mobile|Teacher|Student|Course)/i.test(candidate)) {
                        data.nickname = candidate;
                        break;
                    }
                }
            }
        }
    }
    
    // Strategy 4: Extract from structured format (if OCR detected structure)
    if (!data.nickname || data.nickname.length < 1) {
        // Look for pattern: "Student Name: XXXX\nNickname: YYYY"
        const structuredMatch = rawText.match(/Student\s+Name[:\s]+[^\n]+\n[^\n]*Nickname[:\s]+([^\n]{1,50})/i);
        if (structuredMatch) {
            const extracted = structuredMatch[1].trim();
            if (extracted.length > 0 && extracted.length <= 50) {
                data.nickname = extracted;
            }
        }
    }
    
    // Final validation: ensure nickname doesn't look like a field label
    if (data.nickname) {
        const lower = data.nickname.toLowerCase();
        if (/^(date|sex|school|parent|mobile|teacher|student|course|nickname)[:\s]/i.test(data.nickname)) {
            data.nickname = ''; // Clear if it looks like a label
        }
    }

    // Advanced School Extraction with Multiple Fallback Strategies
    // Strategy 1: Standard pattern with lookahead (most precise)
    let schoolMatch = rawText.match(/School[:\s]+(.*?)(?=\s+(?:Date|Sex|Parent|Mobile|Teacher|Student|Course|$))/i);
    if (schoolMatch) {
        let extracted = schoolMatch[1].trim();
        // Clean up: remove common field labels that might have leaked
        extracted = extracted.replace(/\s*(?:Date|Sex|Parent|Mobile|Teacher|Student|Course)[:\s].*$/i, '').trim();
        if (extracted.length > 0 && extracted.length <= 100) {
            data.school = extracted;
        }
    } else {
        // Strategy 2: Match until newline (handles rotated/malformed text)
        schoolMatch = rawText.match(/School[:\s]+([^\n\r]{1,100})/i);
        if (schoolMatch) {
            let extracted = schoolMatch[1].trim();
            // Clean up: remove common field labels that might have leaked
            extracted = extracted.replace(/\s*(?:Date|Sex|Parent|Mobile|Teacher|Student|Course)[:\s].*$/i, '').trim();
            if (extracted.length > 0 && extracted.length <= 100) {
                data.school = extracted;
            }
        }
    }
    
    // Strategy 3: Positional extraction - if "School:" exists, get text from next line
    if (!data.school || data.school.length < 1) {
        const lines = rawText.split('\n');
        const schoolLabelIndex = lines.findIndex(line => /School[:\s]*/i.test(line));
        if (schoolLabelIndex >= 0 && schoolLabelIndex < lines.length - 1) {
            // Check next 2 lines for potential school name
            for (let i = 1; i <= 2; i++) {
                const candidate = lines[schoolLabelIndex + i]?.trim();
                if (candidate && candidate.length >= 1 && candidate.length <= 100) {
                    // Quick validation: not a field label, not mostly numbers
                    const digits = candidate.replace(/\D/g, '').length;
                    if (digits < candidate.length * 0.7 && !/^(Date|Sex|Parent|Mobile|Teacher|Student|Course)/i.test(candidate)) {
                        data.school = candidate;
                        break;
                    }
                }
            }
        }
    }
    
    // Final validation: ensure school doesn't look like a field label
    if (data.school) {
        if (/^(date|sex|school|parent|mobile|teacher|student|course|nickname)[:\s]/i.test(data.school)) {
            data.school = ''; // Clear if it looks like a label
        }
    }

    // Critical Fix for DOB Leaking "Parent Name"
    const dobMatch = rawText.match(/Date of Birth[:\s]+(.*?)(?=\s+(?:Sex|Parent|Mobile|Teacher|$))/i);
    if (dobMatch) data.dob = dobMatch[1].trim();

    const sexMatch = rawText.match(/Sex[:\s]+(Male|Female)/i);
    if (sexMatch) data.sex = sexMatch[1];

    // Advanced Parent Name Extraction with Fallbacks
    let parentMatch = rawText.match(/Parent Name[:\s]+(.*?)(?=\s+(?:Mobile|Teacher|Course|Student|$))/i);
    if (parentMatch) {
        data.parentName = parentMatch[1].trim();
    } else {
        // Fallback: Match until newline
        parentMatch = rawText.match(/Parent Name[:\s]+([^\n\r]{1,100})/i);
        if (parentMatch) {
            let extracted = parentMatch[1].trim();
            // Clean up: remove common field labels that might have leaked
            extracted = extracted.replace(/\s*(?:Mobile|Teacher|Course|Student)[:\s].*$/i, '').trim();
            if (extracted.length > 0) {
                data.parentName = extracted;
            }
        }
    }
    
    // Positional extraction for parent name
    if (!data.parentName || data.parentName.length < 2) {
        const lines = rawText.split('\n');
        const parentLabelIndex = lines.findIndex(line => /Parent Name[:\s]*/i.test(line));
        if (parentLabelIndex >= 0 && parentLabelIndex < lines.length - 1) {
            // Check next 2 lines for potential parent name
            for (let i = 1; i <= 2; i++) {
                const candidate = lines[parentLabelIndex + i]?.trim();
                if (candidate && candidate.length >= 2 && candidate.length <= 100) {
                    // Quick validation: not a field label, not mostly numbers
                    const digits = candidate.replace(/\D/g, '').length;
                    if (digits < candidate.length * 0.5 && !/^(Mobile|Teacher|Course|Student)/i.test(candidate)) {
                        data.parentName = candidate;
                        break;
                    }
                }
            }
        }
    }

    const mobileMatch = rawText.match(/Mobile[:\s]+([\d\s]+)/i);
    if (mobileMatch) data.mobile = mobileMatch[1].replace(/[\s-]/g, '');

    // 1. Look for explicit "Course:" label
    const lines = rawText.split('\n');
    const courseLine = lines.find(line => line.toLowerCase().startsWith('course'));
    if (courseLine) {
        data.courseTitle = courseLine.replace(/^Course\s+/i, '').replace(/\(at home\)/i, '').trim();
    }

    // 2. Fuzzy match against known courses (Longest match wins)
    if (!data.courseTitle) {
        const sortedTitles = knownCourses
            .map(c => c.title)
            .filter(t => t && t.length > 3)
            .sort((a, b) => b.length - a.length); // Longest first

        for (const title of sortedTitles) {
            // Case insensitive check
            const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedTitle, 'i');
            if (regex.test(rawText)) {
                console.log(`    🔍 Fuzzy matched course: ${title}`);
                data.courseTitle = title;
                break;
            }
        }
    }

    // 3. Positional Heuristic: Check lines above table headers
    if (!data.courseTitle) {
        // Common headers in the form
        const headerIndex = lines.findIndex(line => 
            /Student Signature|Teacher|Sunday|Saturday|Monday|Tuesday|Wednesday|Thursday|Friday/.test(line)
        );

        if (headerIndex > 0) {
            // Look at 1-3 lines above the header
            // Usually the course name is right above the table
            const potentialLine = lines[headerIndex - 1].trim();
            if (potentialLine.length > 3 && !potentialLine.includes('Mobile:')) {
                console.log(`    📍 Positional match found: ${potentialLine}`);
                data.courseTitle = potentialLine;
            } else if (headerIndex > 1) {
                 const potentialLine2 = lines[headerIndex - 2].trim();
                 if (potentialLine2.length > 3 && !potentialLine2.includes('Mobile:')) {
                    console.log(`    📍 Positional match found (line -2): ${potentialLine2}`);
                    data.courseTitle = potentialLine2;
                 }
            }
        }
    }

    return data;
}

// Helper: Clean DOB
// Helper: Clean DOB (Strict)
function cleanDob(raw: string): string {
    if (!raw) return '';
    
    // 1. Format: DD-MMM-YY (e.g. 12-Feb-19)
    const parts = raw.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2})/);
    if (parts) {
        const day = parts[1].padStart(2, '0');
        const monthStr = parts[2].toLowerCase();
        const yearShort = parts[3];
        const year = '20' + yearShort;

        const monthMap: Record<string, string> = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
            'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        };

        const month = monthMap[monthStr] || '01';
        return `${year}-${month}-${day}`;
    }

    // 2. Format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }

    // 3. Format: DD/MM/YYYY
    const partsSlash = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (partsSlash) {
         return `${partsSlash[3]}-${partsSlash[2].padStart(2, '0')}-${partsSlash[1].padStart(2, '0')}`;
    }

    // If no match, discard Garbage (do NOT return raw)
    return ''; 
}

// Helper: Clean phone
// Helper: Clean phone (Strict)
function cleanPhone(raw: string): string {
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    
    // Reject noise (too short)
    if (digits.length < 9) return '';

    if (digits.length > 12 && digits.startsWith('0')) {
        return digits.substring(0, 10);
    }
    return digits;
}

// Helper: Validate Student ID format
function isValidStudentId(studentId: string): { valid: boolean; reason?: string } {
    if (!studentId || studentId.length < 4) {
        return { valid: false, reason: 'Student ID too short or missing' };
    }
    
    // Check for invalid formats
    if (studentId.startsWith('22024')) {
        return { valid: false, reason: `Invalid Student ID format: ${studentId} (should start with 2024, not 22024)` };
    }
    
    // Check for extra digits (should be 9-10 digits total)
    if (/^20\d{7,9}$/.test(studentId)) {
        // Valid format: 20XX + 7-9 digits
        if (studentId.length > 10) {
            return { valid: false, reason: `Invalid Student ID format: ${studentId} (too long, has extra digits)` };
        }
        return { valid: true };
    }
    
    // Check if it's mostly digits but wrong format
    const digits = studentId.replace(/\D/g, '');
    if (digits.length >= 4 && digits.length <= 12) {
        return { valid: false, reason: `Invalid Student ID format: ${studentId} (should be 9-10 digits starting with year)` };
    }
    
    return { valid: false, reason: `Invalid Student ID format: ${studentId}` };
}

// Helper: Detect Thai characters in text
function containsThai(text: string): boolean {
    if (!text) return false;
    // Thai Unicode range: \u0E00-\u0E7F
    return /[\u0E00-\u0E7F]/.test(text);
}

// Helper: Validate name
function isBadName(name: string): boolean {
    if (!name || name.length < 3) return true;
    const lower = name.toLowerCase();
    
    // 1. Check for label leaks
    const labels = ['sex', 'sex:', 'mobile', 'mobile:', 'date of birth', 'parent', 'student', 'gender', 'gender:', 'name:'];
    if (labels.some(k => lower.includes(k))) return true;

    // 2. Check for "nonsense" extracted as names (School, Time, Dates)
    const badKeywords = ['school:', 'school', 'time:', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    if (badKeywords.some(k => lower.includes(k))) return true;

    // 3. Check if it looks like a phone number or numeric only
    const digits = name.replace(/\D/g, '');
    if (digits.length > 6) return true; // Likely a phone number
    if (/^[\d\W]+$/.test(name)) return true; // Only digits/symbols
    
    // 4. Check for obvious OCR errors (dots, very short, etc.)
    if (name.startsWith('..') || name === '..' || name.length < 2) return true;
    if (/^[A-Z]{1,2}$/.test(name) && name.length <= 2) return true; // Single/two letter names are suspicious

    return false;
}

// Helper: Validate phone number format
function isValidPhone(phone: string): { valid: boolean; reason?: string } {
    if (!phone) return { valid: true }; // Empty phone is OK
    
    // Thai mobile: should be 10 digits, starting with 0
    if (phone.length !== 10) {
        return { valid: false, reason: `Invalid phone length: ${phone.length} digits (should be 10)` };
    }
    
    if (!phone.startsWith('0')) {
        return { valid: false, reason: `Invalid phone format: ${phone} (should start with 0)` };
    }
    
    if (!/^\d{10}$/.test(phone)) {
        return { valid: false, reason: `Invalid phone format: ${phone} (should be 10 digits)` };
    }
    
    return { valid: true };
}

// Helper: Validate Data
function validateData(data: any): string[] {
    const warnings: string[] = [];
    
    // Validate DOB (Age approx 4-18)
    if (data.dob) {
        const year = parseInt(data.dob.split('-')[0]);
        const currentYear = new Date().getFullYear();
        const age = currentYear - year;
        if (age < 3 || age > 20) {
            warnings.push(`Suspicious Age: ${age} (DOB: ${data.dob})`);
        }
    }

    // Validate Phone (Thai mobile usually 10 digits, starts with 0)
    if (data.phone) {
        if (data.phone.length !== 10 || !data.phone.startsWith('0')) {
            warnings.push(`Suspicious Phone: ${data.phone}`);
        }
    }

    return warnings;
}

// Helper: Generate HTML Report
function generateHtmlReport(outputFolder: string, failures: any[], warnings: any[]) {
    const reportPath = path.join(outputFolder, 'ocr-report.html');
    
    // Helper to format path for HTML (Windows backslash fix)
    const getImgSrc = (file: string) => {
        const relativePath = `../../${path.basename(outputFolder)}/jpg-cache/${path.basename(file, path.extname(file))}.jpg`;
        return relativePath.replace(/\\/g, '/');
    };
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>OCR Ingestion Report</title>
        <style>
            body { font-family: sans-serif; padding: 20px; background: #f0f2f5; }
            .card { background: white; padding: 15px; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .error { border-left: 5px solid #dc3545; }
            .warning { border-left: 5px solid #ffc107; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
            img { max-width: 100%; height: auto; border-radius: 4px; margin-top: 10px; cursor: pointer; }
            h2 { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 5px; }
            .meta { font-size: 0.9em; color: #666; }
        </style>
    </head>
    <body>
        <h1>OCR Processing Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        
        <h2>❌ Failures (${failures.length})</h2>
        <div class="grid">
            ${failures.map(f => `
                <div class="card error">
                    <strong>File:</strong> ${f.file}<br>
                    <strong>Reason:</strong> ${f.reason}<br>
                    <img src="${getImgSrc(f.file)}" alt="Failed Image" onclick="window.open(this.src)">
                </div>
            `).join('')}
        </div>

        <h2>⚠️ Warnings (${warnings.length})</h2>
        <div class="grid">
            ${warnings.map(w => `
                <div class="card warning">
                    <strong>File:</strong> ${w.file}<br>
                    <strong>Student:</strong> ${w.studentName} (${w.studentId})<br>
                    <ul>${w.warnings.map((msg: string) => `<li>${msg}</li>`).join('')}</ul>
                    <img src="${getImgSrc(w.file)}" alt="Warning Image" onclick="window.open(this.src)">
                </div>
            `).join('')}
        </div>
    </body>
    </html>
    `;
    
    fs.writeFileSync(reportPath, html);
    console.log(`\n📊 Generated HTML Report: ${reportPath}`);
}

// [Deleted unused global processYearFolder function]

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const specificFolder = args.find(arg => !arg.startsWith('--')); // First non-flag argument
    const isRetryMode = args.includes('--retry');
    const isExhaustiveMode = args.includes('--exhaustive');

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║        Multi-Year OCR Ingestion Script (Premium)             ║');
    if (isRetryMode) console.log('║        MODE: RETRY FAILURES ONLY                             ║');
    if (isExhaustiveMode) console.log('║        MODE: EXHAUSTIVE (All images, both angles)           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // Start persistent OCR worker
    try {
        await startOCRWorker();
    } catch (error: any) {
        console.error(`\n❌ Failed to start OCR worker: ${error.message}`);
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
        console.error('\n❌ No year folders found (format: YYYY-YYYY or YYYY)');
        console.log('Expected folders like: 2019-2020, 2024, etc.');
        return;
    }

    // Helper: Process single year
    const processYear = async (yearFolder: string) => {
        console.log(`\n${'='.repeat(60)}`);
        const modeLabel = isRetryMode ? '(RETRY MODE)' : (isExhaustiveMode ? '(EXHAUSTIVE MODE)' : '');
        console.log(`📅 Processing Year: ${yearFolder} ${modeLabel}`);
        console.log('='.repeat(60));

        const inputFolder = path.join(ROOT_DIR, yearFolder);
        const outputFolder = path.join(OUTPUT_BASE_DIR, yearFolder);
        const jpgCacheFolder = path.join(inputFolder, 'jpg-cache'); // Cache JPGs in source folder

        if (!fs.existsSync(inputFolder)) {
            console.error(`❌ Input folder not found: ${inputFolder}`);
            return;
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

        // Logic: Clean vs Retry vs Exhaustive
        let filesToProcess: string[] = [];

        if (isRetryMode) {
             // RETRY MODE: Read failures.csv
             if (fs.existsSync(FAILURES_CSV)) {
                 const failuresContent = fs.readFileSync(FAILURES_CSV, 'utf-8');
                 const failures = parse(failuresContent, { columns: true, skip_empty_lines: true });
                 filesToProcess = failures.map((f: any) => f.file);
                 console.log(`♻️  Retrying ${filesToProcess.length} failed images from failures.csv`);
                 
                 // Clean up the failures file (we will write a new one with remaining failures)
                 // Actually, we should probably append to the existing students/sessions, but overwrite failures?
                 // Let's truncate failures.csv effectively by overwriting it later. 
                 // We don't delete Students/Parents/Sessions CSVs in retry mode.
             } else {
                 console.log(`⚠️  No failures.csv found for ${yearFolder}. Skipping.`);
                 return;
             }
        } else {
            // NORMAL/EXHAUSTIVE MODE: Clean start (or process all)
            if (fs.existsSync(STUDENTS_CSV)) fs.unlinkSync(STUDENTS_CSV);
            if (fs.existsSync(PARENTS_CSV)) fs.unlinkSync(PARENTS_CSV);
            if (fs.existsSync(SESSIONS_CSV)) fs.unlinkSync(SESSIONS_CSV);
            if (fs.existsSync(FAILURES_CSV)) fs.unlinkSync(FAILURES_CSV);
            console.log(`🧹 Cleared old CSV files for ${yearFolder}`);
            
            filesToProcess = fs.readdirSync(inputFolder)
                .filter(f => ['.jpg', '.jpeg', '.png', '.heic'].includes(path.extname(f).toLowerCase()));
        }

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

            // Pass exhaustive flag: --retry uses exhaustive, --exhaustive uses exhaustive, normal uses fast
            const useExhaustive = isRetryMode || isExhaustiveMode;
            const data = await processImage(path.join(inputFolder, file), jpgCacheFolder, allCourses, useExhaustive);
            if (!data) {
                 failedImages.push({
                     file: file,
                     reason: 'OCR Extraction Failed (No data or python error)'
                 });
                 continue;
            }

            // ... (Rest of processing logic remains same, just verify context)
            // Need to copy the logic block here or refactor. 
            // Since we are replacing the whole 'processYearFolder' function in previous steps, 
            // I will assume I need to paste the full processing logic here.
            
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
            if (existingStudentIds.has(data.studentId)) {
                // In retry mode, we might hit this if we are reprocessing a student who succeeded partly?
                // But we are processing FILES that failed. So likely they are not in CSV.
                console.log(`\n    ℹ️  Student ${data.studentId} already exists (checking for new sessions)`);
            }

            // Validate student name - WARNING only (don't fail, allow partial saves)
            let studentNameWarning = null;
            if (isBadName(data.studentName || '')) {
                studentNameWarning = `Bad student name: "${data.studentName}" (OCR error or invalid format)`;
                console.warn(`\n    ⚠️  ${studentNameWarning}`);
                // Clear bad name but continue processing (we can still save sessions)
                data.studentName = '';
            }

            // Clean phone number
            data.mobile = cleanPhone(data.mobile || '');
            data.dob = cleanDob(data.dob || '');

            // Validate phone number format - WARNING only (don't fail)
            let phoneWarning = null;
            if (data.mobile) {
                const phoneValidation = isValidPhone(data.mobile);
                if (!phoneValidation.valid) {
                    phoneWarning = phoneValidation.reason || `Invalid phone number: ${data.mobile}`;
                    console.warn(`\n    ⚠️  ${phoneWarning}`);
                    // Clear invalid phone but continue
                    data.mobile = '';
                }
            }

            // Validate parent name - WARNING only (parent is optional, never fail on this)
            let parentNameWarning = null;
            if (data.parentName && isBadName(data.parentName)) {
                parentNameWarning = `Bad parent name: "${data.parentName}" (OCR error or invalid format)`;
                console.warn(`\n    ⚠️  ${parentNameWarning}`);
                // Clear bad parent name but continue (parent is optional)
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
            
            // Fail image if Thai text is detected
            if (thaiDetections.length > 0) {
                const thaiFields = thaiDetections.join(', ');
                console.warn(`\n    ❌ Thai text detected in: ${thaiFields}`);
                failedImages.push({
                    file: file,
                    reason: `Thai text detected in: ${thaiFields} (OCR using English model cannot accurately process Thai text)`
                });
                continue; // Skip processing this image
            }
            
            // Collect all warnings
            const allWarnings: string[] = [];
            if (studentNameWarning) allWarnings.push(studentNameWarning);
            if (phoneWarning) allWarnings.push(phoneWarning);
            if (parentNameWarning) allWarnings.push(parentNameWarning);
            
            // Smart Validation (warnings for suspicious but not invalid data)
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

            // Only fail if we have NO valid student ID (this is critical)
            if (!data.studentId) {
                console.warn(`\n    ❌ No valid student ID extracted - skipping image`);
                failedImages.push({
                    file: file,
                    reason: 'No valid student ID extracted (critical field missing)'
                });
                continue;
            }
            
            // Fail if student name is missing AND we have a valid ID (inconsistent data)
            // But allow if name extraction failed completely (we'll flag it as warning)
            if (!data.studentName || data.studentName.length < 2) {
                // Check if we have other data that suggests the image was processed
                // If we have course/session data, we might still want to save it
                // But if we have NO name and NO course, it's likely a bad extraction
                if (!data.courseTitle) {
                    console.warn(`\n    ❌ No student name and no course extracted - skipping image`);
                    failedImages.push({
                        file: file,
                        reason: 'No student name and no course extracted (insufficient data)'
                    });
                    continue;
                }
                // If we have course but no name, warn but continue (might be a session-only image)
                console.warn(`\n    ⚠️  No student name extracted, but course found - continuing with session only`);
            }

            console.log(`\n    ✅ Extracted: ${data.studentId} - ${data.studentName || '(name not extracted)'}`);

            // Add student (only if we have valid name - don't save students with "Male"/"Female" as names)
            if (data.studentId && data.studentName && data.studentName.length >= 2 && !existingStudentIds.has(data.studentId)) {
                // Double-check: reject if name is "Male" or "Female"
                if (!/^(Male|Female|male|female)$/i.test(data.studentName.trim())) {
                    const newStudent = {
                        studentId: data.studentId,
                        name: data.studentName,
                        nickname: data.nickname || '',
                        dob: data.dob || '',
                        gender: data.sex || '',
                        phone: data.mobile || '',
                        sourceImage: data.sourceImage || '',
                        school: data.school || '',
                        allergic: '',
                        doNotEat: '',
                        adConcent: 'FALSE',
                        profilePicture: '',
                        profileKey: '',
                        nationalId: ''
                    };
                    newStudents.push(newStudent);
                    existingStudentIds.add(data.studentId);
                    console.log(`    busts[+] Queued Student: ${JSON.stringify(newStudent, null, 2)}`);
                } else {
                    console.warn(`    ⚠️  Skipping student ${data.studentId}: Name "${data.studentName}" is a Sex value, not a name`);
                }
            } else if (data.studentId && (!data.studentName || data.studentName.length < 2) && !existingStudentIds.has(data.studentId)) {
                // If we have ID but no name, still save for sessions (but flag it)
                console.warn(`    ⚠️  Saving student ${data.studentId} without name (for session linking)`);
                const newStudent = {
                    studentId: data.studentId,
                    name: '', // Empty name
                    nickname: data.nickname || '',
                    dob: data.dob || '',
                    gender: data.sex || '',
                    phone: data.mobile || '',
                    sourceImage: data.sourceImage || '',
                    school: data.school || '',
                    allergic: '',
                    doNotEat: '',
                    adConcent: 'FALSE',
                    profilePicture: '',
                    profileKey: '',
                    nationalId: ''
                };
                newStudents.push(newStudent);
                existingStudentIds.add(data.studentId);
            }

            // Add parent (only if name is valid and not empty)
            // Parent is optional - only add if we have a valid name
            if (data.parentName && data.parentName.trim().length > 0 && !isBadName(data.parentName)) {
                const parentKey = data.parentName.toLowerCase();
                if (!newParentNames.has(parentKey)) {
                    const newParent = {
                        name: data.parentName,
                        contactNo: data.mobile || '',
                        sourceImage: data.sourceImage || '',
                        email: '',
                        lineId: '',
                        address: '',
                        profilePicture: '',
                        profileKey: ''
                    };
                    newParents.push(newParent);
                    newParentNames.add(parentKey);
                    console.log(`    [+] Queued Parent: ${JSON.stringify(newParent, null, 2)}`);
                }
            }

            // Add session (match course)
            let courseId = '';
            if (data.courseTitle) {
                const match = allCourses.find(c => 
                    c.title.toLowerCase().includes(data.courseTitle.toLowerCase()) || 
                    data.courseTitle.toLowerCase().includes(c.title.toLowerCase())
                );

                if (match) {
                    courseId = match.id;
                    console.log(`    📚 Matched course: ${data.courseTitle} → ${courseId}`);
                } else {
                    const maxId = allCourses.reduce((max, c) => Math.max(max, parseInt(c.id) || 0), 0);
                    const newId = (maxId + 1).toString();
                    
                    const newCourse = {
                        id: newId,
                        title: data.courseTitle,
                        description: `Imported from OCR (${yearFolder})`,
                        ageRange: 'TBD',
                        medium: 'TBD'
                    };
                    
                    coursesToAppend.push(newCourse);
                    allCourses.push(newCourse);
                    courseId = newId;
                    console.log(`    📚 Created new course: ${data.courseTitle} → ${newId}`);
                }
            }

            if (data.studentId && courseId) {
                const newSession = {
                    studentId: data.studentId,
                    courseId: courseId,
                    classOptionId: '1',
                    teacherId: '',
                    status: 'wip',
                    payment: 'Paid',
                    classCancel: '0',
                    sourceImage: data.sourceImage || ''
                };
                newSessions.push(newSession);
                console.log(`    [+] Queued Session: ${JSON.stringify(newSession, null, 2)}`);
            }
        } // End Loop

        // Write CSVs (Append)
        if (newStudents.length > 0) {
            const writer = createObjectCsvWriter({
                path: STUDENTS_CSV,
                header: [
                    {id: 'studentId', title: 'studentId'},
                    {id: 'name', title: 'name'},
                    {id: 'nickname', title: 'nickname'},
                    {id: 'nationalId', title: 'nationalId'},
                    {id: 'dob', title: 'dob'},
                    {id: 'gender', title: 'gender'},
                    {id: 'school', title: 'school'},
                    {id: 'allergic', title: 'allergic'},
                    {id: 'doNotEat', title: 'doNotEat'},
                    {id: 'adConcent', title: 'adConcent'},
                    {id: 'phone', title: 'phone'},
                    {id: 'sourceImage', title: 'sourceImage'},
                    {id: 'profilePicture', title: 'profilePicture'},
                    {id: 'profileKey', title: 'profileKey'}
                ],
                append: fs.existsSync(STUDENTS_CSV)
            });
            await writer.writeRecords(newStudents);
            console.log(`\n✅ Wrote ${newStudents.length} students to ${path.basename(STUDENTS_CSV)}`);
        }

        if (newParents.length > 0) {
            const writer = createObjectCsvWriter({
                path: PARENTS_CSV,
                header: [
                    {id: 'name', title: 'name'},
                    {id: 'email', title: 'email'},
                    {id: 'contactNo', title: 'contactNo'},
                    {id: 'lineId', title: 'lineId'},
                    {id: 'address', title: 'address'},
                    {id: 'sourceImage', title: 'sourceImage'},
                    {id: 'profilePicture', title: 'profilePicture'},
                    {id: 'profileKey', title: 'profileKey'}
                ],
                append: fs.existsSync(PARENTS_CSV)
            });
            await writer.writeRecords(newParents);
            console.log(`✅ Wrote ${newParents.length} parents to ${path.basename(PARENTS_CSV)}`);
        }

        if (newSessions.length > 0) {
            const writer = createObjectCsvWriter({
                path: SESSIONS_CSV,
                header: [
                    {id: 'studentId', title: 'studentId'},
                    {id: 'courseId', title: 'courseId'},
                    {id: 'classOptionId', title: 'classOptionId'},
                    {id: 'teacherId', title: 'teacherId'},
                    {id: 'status', title: 'status'},
                    {id: 'payment', title: 'payment'},
                    {id: 'classCancel', title: 'classCancel'},
                    {id: 'sourceImage', title: 'sourceImage'}
                ],
                append: fs.existsSync(SESSIONS_CSV)
            });
            await writer.writeRecords(newSessions);
            console.log(`✅ Wrote ${newSessions.length} sessions to ${path.basename(SESSIONS_CSV)}`);
        }

        // Append new courses
        if (coursesToAppend.length > 0) {
            const writer = createObjectCsvWriter({
                path: MASTER_COURSES_CSV,
                header: [
                    {id: 'id', title: 'id'},
                    {id: 'title', title: 'title'},
                    {id: 'description', title: 'description'},
                    {id: 'ageRange', title: 'ageRange'},
                    {id: 'medium', title: 'medium'}
                ],
                append: fs.existsSync(MASTER_COURSES_CSV)
            });
            await writer.writeRecords(coursesToAppend);
            console.log(`✅ Added ${coursesToAppend.length} new courses to master list`);
        }

        // Write Failures (Overwriting old failures with NEW remaining failures)
        if (failedImages.length > 0) {
            const writer = createObjectCsvWriter({
                path: FAILURES_CSV,
                header: [
                    {id: 'file', title: 'file'},
                    {id: 'reason', title: 'reason'}
                ]
            });
            await writer.writeRecords(failedImages);
            console.log(`\n❌ Wrote ${failedImages.length} failed images to ${path.basename(FAILURES_CSV)}`);
        } else if (isRetryMode) {
             console.log(`\n✨ All retried images processed successfully!`);
             if(fs.existsSync(FAILURES_CSV)) fs.unlinkSync(FAILURES_CSV);
        }
        
        // Generate HTML Report
        generateHtmlReport(outputFolder, failedImages, warningImages);
    };

    // Process each year
    for (const yearFolder of yearFolders) {
        await processYear(yearFolder);
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                  OCR Processing Complete!                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`\n📁 Output location: ${OUTPUT_BASE_DIR}`);
    if(isRetryMode) console.log('\n🚀 Next step: Check if failures are cleared.');
    else console.log('\n🚀 Next step: Open generated HTML report to verify data.');
    
    // Stop OCR worker
    await stopOCRWorker();
}

main().catch(async (error) => {
    console.error('\n❌ Fatal error:', error);
    await stopOCRWorker();
    process.exit(1);
});
