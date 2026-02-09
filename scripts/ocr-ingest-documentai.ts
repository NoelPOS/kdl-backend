/**
 * Google Document AI OCR Ingestion Script
 * 
 * Processes HEIC images using Google Document AI Form Parser for high accuracy
 * 
 * Usage:
 *   npx ts-node scripts/ocr-ingest-documentai.ts 2019
 *   npx ts-node scripts/ocr-ingest-documentai.ts  (all folders)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as heicConvert from 'heic-convert';
import { createObjectCsvWriter } from 'csv-writer';
import { parse } from 'csv-parse/sync';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import * as util from 'util';

// ============================================================
// CONFIGURATION
// ============================================================

const ROOT_DIR = path.join(__dirname, '../..');
const OUTPUT_BASE_DIR = path.join(ROOT_DIR, 'ocr-output');
const LOG_FILE = path.join(ROOT_DIR, `ocr-log-documentai-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
const MASTER_COURSES_CSV = path.join(ROOT_DIR, 'courses_master.csv');

// Google Document AI Configuration
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const LOCATION = process.env.GOOGLE_LOCATION || 'us';
const PROCESSOR_ID = process.env.GOOGLE_PROCESSOR_ID;

// AI API Configuration (for course extraction)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Auto-detect which AI service to use (priority: Gemini > OpenAI > Claude)
const AI_SERVICE = GEMINI_API_KEY ? 'gemini' : OPENAI_API_KEY ? 'openai' : ANTHROPIC_API_KEY ? 'claude' : null;

// Rate limiting for AI API (15 requests/minute for Gemini free tier)
let lastApiCall = 0;
const API_RATE_LIMIT_MS = 4100; // ~14.6 requests/minute (safe margin)

// Helper to detect corrupted Thai text (Latin chars with diacritics)
function hasCorruptedThai(text: string): boolean {
    // Check for Latin characters with diacritics that indicate Thai corruption
    const corruptionPattern = /[ňáíúŕťýůíóńěšďřťž]/i;
    return corruptionPattern.test(text);
}

if (!PROJECT_ID || !PROCESSOR_ID) {
    console.error('❌ Missing Google Document AI configuration!');
    console.error('   Set GOOGLE_PROJECT_ID and GOOGLE_PROCESSOR_ID in backend.env');
    process.exit(1);
}

// Initialize Document AI client
const client = new DocumentProcessorServiceClient();

// Logging setup
const logFileStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
const originalConsoleLog = console.log;

function log(...args: any[]) {
    const rawMsg = util.format(...args);
    originalConsoleLog(rawMsg);
    logFileStream.write(rawMsg + '\n');
}
console.log = log;

// ============================================================
// TYPES
// ============================================================

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

interface StudentRecord {
    studentId: string;
    name: string;
    nickname: string;
    nationalId: string;
    dob: string;
    gender: string;
    school: string;
    allergic: string;
    doNotEat: string;
    adContent: string;
    phone: string;
    sourceImage: string;
}

interface SessionRecord {
    sessionId: number;
    studentId: string;
    courseId: number;
    classOptionId: string;
    classCancel: string;
    payment: string;
    status: string;
    teacherId: string;
    InvoiceDone: string;
    packageGroupId: string;
    sourceImage: string;
}

interface ParentRecord {
    parentId: number;
    name: string;
    studentId: string;
    phone: string;
    sourceImage: string;
}

// ============================================================
// AI API COURSE EXTRACTION (Gemini, OpenAI, Claude)
// ============================================================

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractCourseWithAI(fullText: string): Promise<string | undefined> {
    if (!AI_SERVICE) return undefined;

    // Rate limiting: ensure minimum delay between API calls
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall;
    if (timeSinceLastCall < API_RATE_LIMIT_MS) {
        const waitTime = API_RATE_LIMIT_MS - timeSinceLastCall;
        await sleep(waitTime);
    }
    lastApiCall = Date.now();

    const prompt = `Extract the course/class name from this student registration form.

Look for course names that appear:
1. After "Course": "Course C-B1 (ENG)"
2. As table headers before time slots like "10.00-12.00" or "Sunday"
3. Before price numbers or date columns

Course name patterns (extract COMPLETE name):
- Code format: "C-B1", "K-B2", "C-Intermediate"
- Subject + Language: "General Python", "Basic JavaScript", "Web Design"
- Subject + Level: "Arduino I", "Scratch II", "Robotics Advanced"
- Technology: "Micro controller", "3D Printing"
- Competitions: "MakeX 2020 Competition"

CRITICAL: Return the FULL course name, not just the first word!

Examples (learn from these):
"Course C-B1 (ENG) | Sunday" → C-B1
"Micro controller | Date | Student" → Micro controller
"General Python | 9345.79 | Sunday | 10.00-12.00" → General Python
"MakeX 2020 Competition | Sunday | 15.00" → MakeX 2020 Competition
"Web Design II | Saturday | Teacher" → Web Design II
"Arduino Programming | 089 704 7444" → Arduino Programming

If NO course name exists, return: NONE

Text to analyze:
${fullText.substring(0, 800)}`;

    try {
        if (AI_SERVICE === 'gemini') {
            return await extractWithGemini(prompt);
        } else if (AI_SERVICE === 'openai') {
            return await extractWithOpenAI(prompt);
        } else if (AI_SERVICE === 'claude') {
            return await extractWithClaude(prompt);
        }
    } catch (error: any) {
        // Retry up to 3 times on rate limit error with exponential backoff
        if (error.message.includes('429') || error.message.includes('rate')) {
            for (let attempt = 1; attempt <= 3; attempt++) {
                const waitTime = 5000 * attempt; // 5s, 10s, 15s
                console.log(`    ⏳ Rate limited, retry ${attempt}/3 - waiting ${waitTime/1000}s...`);
                await sleep(waitTime);
                lastApiCall = Date.now();
                
                try {
                    if (AI_SERVICE === 'gemini') {
                        return await extractWithGemini(prompt);
                    } else if (AI_SERVICE === 'openai') {
                        return await extractWithOpenAI(prompt);
                    } else if (AI_SERVICE === 'claude') {
                        return await extractWithClaude(prompt);
                    }
                } catch (retryError: any) {
                    if (attempt === 3) {
                        console.log(`    ❌ All retries exhausted - skipping course extraction`);
                        return undefined;
                    }
                    // Continue to next retry
                }
            }
        }
        
        console.log(`    ⚠️  ${AI_SERVICE.toUpperCase()} API failed: ${error.message}`);
        return undefined;
    }
}

async function extractWithGemini(prompt: string): Promise<string | undefined> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                maxOutputTokens: 50,
                temperature: 0,
            }
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data: any = await response.json();
    
    // Better error handling
    if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No candidates in response');
    }
    
    let courseText = data.candidates[0]?.content?.parts?.[0]?.text?.trim();
    
    // Clean up the response
    if (courseText) {
        // Remove newlines and normalize whitespace
        courseText = courseText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    
    // Filter out non-course responses
    if (!courseText || 
        courseText === 'NONE' || 
        courseText.toLowerCase().includes('no course') ||
        courseText.toLowerCase().includes('not found') ||
        courseText.toLowerCase().includes('there is no') ||
        courseText.toLowerCase().includes('not present') ||
        courseText.startsWith('(') && courseText.endsWith(')')) {  // Filter "(There is no...)"
        return undefined;
    }
    
    // Filter out obviously wrong extractions (too short or common words)
    if (courseText.length < 3 || 
        ['student signature', 'make up date', 'teacher', 'note', 'date'].includes(courseText.toLowerCase())) {
        return undefined;
    }

    return courseText;
}

// Extract Thai text using Gemini (for names that Document AI corrupts)
async function extractThaiTextWithGemini(imageBuffer: Buffer, fieldName: 'studentName' | 'parentName'): Promise<string | undefined> {
    try {
        // Rate limiting
        const now = Date.now();
        const timeSinceLastCall = now - lastApiCall;
        if (timeSinceLastCall < API_RATE_LIMIT_MS) {
            await sleep(API_RATE_LIMIT_MS - timeSinceLastCall);
        }
        lastApiCall = Date.now();
        
        const base64Image = imageBuffer.toString('base64');
        const prompt = fieldName === 'studentName' 
            ? `Look at this student registration form carefully. Find the field labeled "Student Name:" and read the Thai text written there. The Thai name uses Thai script (อักษรไทย) with characters like ก ข ค ง จ ช ญ etc. Read each Thai character precisely and return ONLY the complete Thai name exactly as written. Do not translate, romanize, or guess - copy the exact Thai characters you see. Format: if there's a title like ด.ญ. or เด็กหญิง, include it. If no Thai text is present, return "NONE".`
            : `Look at this form carefully. Find the field labeled "Parent Name:" and read the Thai text written there. The Thai name uses Thai script (อักษรไทย) with characters like ก ข ค ง จ ช etc. Read each Thai character precisely and return ONLY the complete Thai name exactly as written. Include titles like คุณ if present. Do not translate, romanize, or guess - copy the exact Thai characters you see. If no Thai text is present, return "NONE".`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: base64Image
                            }
                        }
                    ]
                }],
                generationConfig: {
                    maxOutputTokens: 100,
                    temperature: 0,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data: any = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            return undefined;
        }
        
        let thaiText = data.candidates[0]?.content?.parts?.[0]?.text?.trim();
        
        if (!thaiText || thaiText === 'NONE' || thaiText.toLowerCase().includes('no thai') || thaiText.toLowerCase().includes('not found')) {
            return undefined;
        }
        
        // Clean up
        thaiText = thaiText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        
        return thaiText;
        
    } catch (error: any) {
        console.log(`    ⚠️  Gemini Thai extraction failed: ${error.message}`);
        return undefined;
    }
}


async function extractWithOpenAI(prompt: string): Promise<string | undefined> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 50,
            temperature: 0.1,
            messages: [{
                role: 'user',
                content: prompt
            }]
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data: any = await response.json();
    const courseText = data.choices[0]?.message?.content?.trim();
    
    if (courseText === 'NONE' || !courseText) {
        return undefined;
    }

    return courseText;
}

async function extractWithClaude(prompt: string): Promise<string | undefined> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 50,
            messages: [{
                role: 'user',
                content: prompt
            }]
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data: any = await response.json();
    const courseText = data.content[0]?.text?.trim();
    
    if (courseText === 'NONE' || !courseText) {
        return undefined;
    }

    return courseText;
}

// ============================================================
// GOOGLE DOCUMENT AI PROCESSING
// ============================================================

async function processImageWithDocumentAI(imagePath: string): Promise<ExtractedData> {
    try {
        // Read image file and auto-rotate if needed using sharp
        let imageBuffer = fs.readFileSync(imagePath);
        
        // Auto-rotate based on EXIF orientation (handles rotated images)
        const sharp = require('sharp');
        imageBuffer = await sharp(imageBuffer)
            .rotate() // Automatically rotates based on EXIF orientation
            .jpeg({ quality: 90 })
            .toBuffer();
        
        // Construct processor name
        const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;
        
        // Process document (Document AI with Thai + English language hints)
        const result = await client.processDocument({
            name,
            rawDocument: {
                content: imageBuffer,
                mimeType: 'image/jpeg',
            },
            // Add language hints for Thai + English mixed text
            processOptions: {
                ocrConfig: {
                    hints: {
                        languageHints: ['th', 'en'], // Thai first, then English
                    },
                },
            },
        });

        const { document } = result[0];
        if (!document) {
            return {};
        }

        // Extract form fields (key-value pairs)
        const formFields = new Map<string, string>();
        
        if (document.pages && document.pages[0]?.formFields) {
            console.log(`    🔍 Document AI detected ${document.pages[0].formFields.length} form fields:`);
            for (const field of document.pages[0].formFields) {
                const fieldName = getTextFromLayout(field.fieldName, document.text || '');
                const fieldValue = getTextFromLayout(field.fieldValue, document.text || '');
                
                if (fieldName && fieldValue) {
                    formFields.set(fieldName.toLowerCase().trim(), fieldValue.trim());
                    console.log(`       "${fieldName}" = "${fieldValue}"`);
                }
            }
        } else {
            console.log(`    ⚠️  No form fields detected - form may not have clear labels`);
        }

        // Extract all text for debugging and course extraction
        const fullText = document.text || '';
        
        // DEBUG: Print first 500 chars of full text to see what we're working with
        if (fullText) {
            console.log(`    📄 Full text preview (first 500 chars):`);
            console.log(`       ${fullText.substring(0, 500).replace(/\n/g, ' | ')}`);
        }

        // Map Document AI fields to our schema (trim newlines from field names)
        const extracted: ExtractedData = {
            sourceImage: path.basename(imagePath),
        };

        // Helper to find field with newline tolerance
        const findField = (possibleKeys: string[]): string | undefined => {
            for (const key of possibleKeys) {
                for (const [fieldKey, value] of formFields.entries()) {
                    // Remove newlines and extra spaces for comparison
                    const cleanKey = fieldKey.replace(/\s+/g, ' ').trim();
                    if (cleanKey === key || cleanKey.includes(key) || key.includes(cleanKey)) {
                        return value;
                    }
                }
            }
            return undefined;
        };

        // Try to extract each field using various possible field names
        extracted.studentId = findField(['student id:', 'student id', 'id:']);

        extracted.studentName = findField(['student name:', 'student name', 'name:']);

        let rawNickname = findField(['nickname:', 'nickname', 'nick name:', 'nick:']);
        // Clean nickname: sometimes captures full name + nickname, take last part
        if (rawNickname) {
            const lines = rawNickname.split('\n').filter(l => l.trim());
            rawNickname = lines[lines.length - 1].trim();
        }
        extracted.nickname = rawNickname;

        extracted.school = findField(['school:', 'school', 'school name:']);

        extracted.dob = findField(['date of birth:', 'date of birth', 'dob:', 'birth date:']);

        extracted.sex = findField(['gender:', 'sex:', 'gender', 'sex']);

        let rawMobile = findField(['mobile:', 'mobile', 'phone:', 'telephone:', 'tel:', 'contact:']);
        // Clean mobile: take first valid 10-digit number
        if (rawMobile) {
            const match = rawMobile.match(/(\d[\d\s\-]{8,}\d)/);
            if (match) {
                rawMobile = match[1].replace(/[\s\-]/g, '');
            }
        }
        extracted.mobile = rawMobile;

        extracted.parentName = findField(['parent name:', 'parent name', 'parent:', 'guardian:', 'father:', 'mother:']);

        // Fix corrupted Thai text using Gemini
        if (GEMINI_API_KEY) {
            if (extracted.studentName && hasCorruptedThai(extracted.studentName)) {
                console.log(`    🔧 Detected corrupted Thai in student name, using Gemini...`);
                const thaiName = await extractThaiTextWithGemini(imageBuffer, 'studentName');
                if (thaiName) {
                    console.log(`    ✅ Gemini extracted Thai student name: ${thaiName}`);
                    extracted.studentName = thaiName;
                }
            }
            
            if (extracted.parentName && hasCorruptedThai(extracted.parentName)) {
                console.log(`    🔧 Detected corrupted Thai in parent name, using Gemini...`);
                const thaiName = await extractThaiTextWithGemini(imageBuffer, 'parentName');
                if (thaiName) {
                    console.log(`    ✅ Gemini extracted Thai parent name: ${thaiName}`);
                    extracted.parentName = thaiName;
                }
            }
        }

        // Course extraction: Use AI API if available, fallback to regex
        let rawCourseTitle: string | undefined;
        
        if (AI_SERVICE) {
            rawCourseTitle = await extractCourseWithAI(fullText);
            if (rawCourseTitle) {
                console.log(`    🤖 ${AI_SERVICE.toUpperCase()} extracted course: ${rawCourseTitle}`);
            }
        }
        
        // NO REGEX FALLBACK - if AI fails, skip course extraction
        // Regex is too unreliable and creates wrong matches
        if (!rawCourseTitle && !AI_SERVICE) {
            // Only use regex if no AI service is configured at all
            rawCourseTitle = 
                // Pattern 1: "Course C-B1 (ENG)" or "Summer Course C-Halocode"
                extractPattern(fullText, /Course\s+([^|\n]+?)(?:\s*\||$)/i) ||
                // Pattern 2: Standalone course codes
                extractPattern(fullText, /(?:^|\|\s*)([CKP]-[A-Z0-9]+(?:-[A-Z0-9]+)?(?:\s*\([^)]+\))?)\s*(?:\||$)/m) ||
                // Pattern 3: Multi-word course names
                extractPattern(fullText, /(?:^|\|\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?:\s+[IV]+)?\s*(?:\([^)]+\))?\s*(?:\||$)/m);
        }
        
        // Clean course title: remove parentheses, trim, and remove extra spaces
        if (rawCourseTitle) {
            rawCourseTitle = rawCourseTitle
                .replace(/\s*\([^)]+\)/g, '') // Remove (ENG), (Cont.), (Thai) etc.
                .trim()
                .replace(/\s+/g, ' ');
        }
        extracted.courseTitle = rawCourseTitle;

        extracted.teacherName = 
            findFieldValue(formFields, ['teacher', 'teacher name', 'instructor']) ||
            extractPattern(fullText, /(?:teacher|instructor)\s*:?\s*([A-Za-z\s]+)/i);

        return extracted;

    } catch (error: any) {
        console.error(`    ❌ Document AI error: ${error.message}`);
        return { sourceImage: path.basename(imagePath) };
    }
}

// Helper: Get text from Document AI layout structure
function getTextFromLayout(layout: any, fullText: string): string {
    if (!layout || !layout.textAnchor || !layout.textAnchor.textSegments) {
        return '';
    }
    
    let text = '';
    for (const segment of layout.textAnchor.textSegments) {
        const startIndex = parseInt(segment.startIndex || '0');
        const endIndex = parseInt(segment.endIndex || '0');
        text += fullText.substring(startIndex, endIndex);
    }
    return text;
}

// Helper: Find field value from map using multiple possible keys
function findFieldValue(fields: Map<string, string>, possibleKeys: string[]): string | undefined {
    for (const key of possibleKeys) {
        // Exact match
        if (fields.has(key)) return fields.get(key);
        
        // Partial match (e.g., "student id:" matches "student id")
        for (const [fieldKey, value] of fields.entries()) {
            if (fieldKey.includes(key) || key.includes(fieldKey)) {
                return value;
            }
        }
    }
    return undefined;
}

// Helper: Extract using regex pattern from full text
function extractPattern(text: string, pattern: RegExp): string | undefined {
    const match = text.match(pattern);
    return match ? match[1].trim() : undefined;
}

// ============================================================
// HEIC CONVERSION
// ============================================================

async function ensureJpgExists(heicPath: string): Promise<string> {
    const jpgCacheDir = path.join(path.dirname(heicPath), 'jpg-cache');
    const baseName = path.basename(heicPath, path.extname(heicPath));
    const jpgPath = path.join(jpgCacheDir, `${baseName}.jpg`);

    if (fs.existsSync(jpgPath)) {
        console.log('    ♻️  Using cached JPG');
        return jpgPath;
    }

    console.log('    🔄 Converting HEIC → JPG...');
    if (!fs.existsSync(jpgCacheDir)) {
        fs.mkdirSync(jpgCacheDir, { recursive: true });
    }

    const heicBuffer = fs.readFileSync(heicPath);
    const jpgBuffer = await heicConvert({
        buffer: heicBuffer,
        format: 'JPEG',
        quality: 0.9,
    });

    fs.writeFileSync(jpgPath, Buffer.from(jpgBuffer));
    return jpgPath;
}

// ============================================================
// COURSE MATCHING
// ============================================================

function loadCourses(): any[] {
    if (!fs.existsSync(MASTER_COURSES_CSV)) {
        return [];
    }
    const content = fs.readFileSync(MASTER_COURSES_CSV, 'utf-8');
    return parse(content, { columns: true, skip_empty_lines: true });
}

function findOrCreateCourse(courseTitle: string, courses: any[]): { courseId: number; isNew: boolean } {
    if (!courseTitle) {
        return { courseId: 0, isNew: false };
    }

    const normalized = courseTitle.trim().toLowerCase();
    
    // Exact match
    let course = courses.find((c: any) => c.title.toLowerCase() === normalized);
    if (course) {
        const courseId = parseInt(course.id || course.courseId);
        if (isNaN(courseId)) {
            console.log(`    ⚠️  Invalid courseId for ${course.title}, treating as new`);
        } else {
            return { courseId, isNew: false };
        }
    }

    // Fuzzy match (STRICT - only if extracted course is substring of existing)
    // This prevents "C-Challenge1" matching "C-Challenge1-2"
    course = courses.find((c: any) => {
        const existingTitle = c.title.toLowerCase();
        // Only match if extracted course is START of existing course
        // "C-B1" matches "C-B1 Thai" but NOT "C-B2"
        return existingTitle.startsWith(normalized) || 
               existingTitle === normalized ||
               // Allow exact match with extra spaces
               existingTitle.replace(/\s+/g, '') === normalized.replace(/\s+/g, '');
    });
    if (course) {
        const courseId = parseInt(course.id || course.courseId);
        if (isNaN(courseId)) {
            console.log(`    ⚠️  Invalid courseId for ${course.title}, treating as new`);
        } else {
            console.log(`    🔍 Fuzzy matched course: ${courseTitle} → ${course.title}`);
            return { courseId, isNew: false };
        }
    }

    // Create new course
    const existingIds = courses
        .map((c: any) => parseInt(c.id || c.courseId))
        .filter((id: number) => !isNaN(id));
    const newCourseId = existingIds.length > 0 
        ? Math.max(...existingIds) + 1 
        : 1;
    
    const newCourse = {
        id: newCourseId.toString(),
        courseId: newCourseId.toString(), // Keep both for compatibility
        title: courseTitle,
        type: '',
        yearPeriod: '',
        maxStudent: '',
        level: '',
        category: '',
        ages: '',
    };
    
    courses.push(newCourse);
    console.log(`    ➕ Created new course: ${courseTitle} → ${newCourseId}`);
    return { courseId: newCourseId, isNew: true };
}

function saveCourses(courses: any[]): void {
    const csvWriter = createObjectCsvWriter({
        path: MASTER_COURSES_CSV,
        encoding: 'utf8',
        header: [
            { id: 'courseId', title: 'courseId' },
            { id: 'title', title: 'title' },
            { id: 'type', title: 'type' },
            { id: 'yearPeriod', title: 'yearPeriod' },
            { id: 'maxStudent', title: 'maxStudent' },
            { id: 'level', title: 'level' },
            { id: 'category', title: 'category' },
            { id: 'ages', title: 'ages' },
        ],
    });

    csvWriter.writeRecords(courses);
}

// ============================================================
// MAIN PROCESSING
// ============================================================

async function processYearFolder(yearFolder: string): Promise<void> {
    console.log('\n============================================================');
    console.log(`📅 Processing Year: ${yearFolder} (Google Document AI)`);
    console.log('============================================================');

    const yearPath = path.join(ROOT_DIR, yearFolder);
    const outputDir = path.join(OUTPUT_BASE_DIR, yearFolder);

    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Clear old CSV files
    const csvFiles = ['students.csv', 'sessions.csv', 'parents.csv'];
    csvFiles.forEach(file => {
        const filePath = path.join(outputDir, file);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🧹 Cleared old ${file}`);
        }
    });

    // Load master courses
    const courses = loadCourses();

    // Find all HEIC images
    const heicFiles = fs.readdirSync(yearPath)
        .filter(f => f.toLowerCase().endsWith('.heic'))
        .sort();

    if (heicFiles.length === 0) {
        console.log('⚠️  No HEIC images found in folder');
        return;
    }

    console.log(`📸 Queue: ${heicFiles.length} images`);

    // Data collectors
    const students: StudentRecord[] = [];
    const sessions: SessionRecord[] = [];
    const parents: ParentRecord[] = [];
    const seenStudentIds = new Set<string>();
    let sessionIdCounter = 1;
    let parentIdCounter = 1;

    // Process each image
    let processedCount = 0;
    for (const heicFile of heicFiles) {
        processedCount++;
        const heicPath = path.join(yearPath, heicFile);
        console.log(`  [${processedCount}/${heicFiles.length}] Processing: ${heicFile}`);

        try {
            // Convert HEIC to JPG
            const jpgPath = await ensureJpgExists(heicPath);

            // Process with Document AI
            const data = await processImageWithDocumentAI(jpgPath);

            if (!data.studentId || !data.studentName) {
                console.log(`    ⚠️  Missing critical data (ID or Name) - skipping`);
                continue;
            }

            // Check if student already exists
            const isNewStudent = !seenStudentIds.has(data.studentId);

            if (isNewStudent) {
                console.log(`    ✅ Extracted: ${data.studentId} - ${data.studentName}`);
                seenStudentIds.add(data.studentId);

                // Normalize gender
                let gender = '';
                if (data.sex) {
                    const s = data.sex.toLowerCase();
                    if (s.startsWith('m')) gender = 'Male';
                    if (s.startsWith('f')) gender = 'Female';
                }

                // Normalize DOB to YYYY-MM-DD
                let dob = '';
                if (data.dob) {
                    const dobMatch = data.dob.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
                    if (dobMatch) {
                        let day = dobMatch[1].padStart(2, '0');
                        let month = dobMatch[2].padStart(2, '0');
                        let year = dobMatch[3];
                        if (year.length === 2) {
                            year = parseInt(year) > 50 ? '19' + year : '20' + year;
                        }
                        dob = `${year}-${month}-${day}`;
                    }
                }

                students.push({
                    studentId: data.studentId,
                    name: data.studentName,
                    nickname: data.nickname || '',
                    nationalId: '',
                    dob: dob,
                    gender: gender,
                    school: data.school || '',
                    allergic: '',
                    doNotEat: '',
                    adContent: '',
                    phone: data.mobile || '',
                    sourceImage: data.sourceImage || '',
                });

                // Add parent if exists
                if (data.parentName && data.mobile) {
                    console.log(`    [+] Queued Parent: ${data.parentName}`);
                    parents.push({
                        parentId: parentIdCounter++,
                        name: data.parentName,
                        studentId: data.studentId,
                        phone: data.mobile,
                        sourceImage: data.sourceImage || '',
                    });
                }
            } else {
                console.log(`    ℹ️  Student ${data.studentId} already exists (checking for new sessions)`);
            }

            // Add session (even for existing students - they may have multiple courses)
            if (data.courseTitle) {
                const { courseId } = findOrCreateCourse(data.courseTitle, courses);
                console.log(`    📚 Matched course: ${data.courseTitle} → ${courseId}`);

                sessions.push({
                    sessionId: sessionIdCounter++,
                    studentId: data.studentId,
                    courseId: courseId,
                    classOptionId: '',
                    classCancel: '',
                    payment: '',
                    status: '',
                    teacherId: '',
                    InvoiceDone: '',
                    packageGroupId: '',
                    sourceImage: data.sourceImage || '',
                });
            }

        } catch (error: any) {
            console.error(`    ❌ Error processing ${heicFile}: ${error.message}`);
        }
    }

    // Write CSV files (with UTF-8 BOM for Excel compatibility with Thai characters)
    console.log(`\n✅ Wrote ${students.length} students to students.csv`);
    const studentsWriter = createObjectCsvWriter({
        path: path.join(outputDir, 'students.csv'),
        encoding: 'utf8',
        append: false,
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
            { id: 'adContent', title: 'adContent' },
            { id: 'phone', title: 'phone' },
            { id: 'sourceImage', title: 'sourceImage' },
        ],
    });
    await studentsWriter.writeRecords(students);

    console.log(`✅ Wrote ${parents.length} parents to parents.csv`);
    const parentsWriter = createObjectCsvWriter({
        path: path.join(outputDir, 'parents.csv'),
        encoding: 'utf8',
        header: [
            { id: 'parentId', title: 'parentId' },
            { id: 'name', title: 'name' },
            { id: 'studentId', title: 'studentId' },
            { id: 'phone', title: 'phone' },
            { id: 'sourceImage', title: 'sourceImage' },
        ],
    });
    await parentsWriter.writeRecords(parents);

    console.log(`✅ Wrote ${sessions.length} sessions to sessions.csv`);
    const sessionsWriter = createObjectCsvWriter({
        encoding: 'utf8',
        path: path.join(outputDir, 'sessions.csv'),
        header: [
            { id: 'sessionId', title: 'sessionId' },
            { id: 'studentId', title: 'studentId' },
            { id: 'courseId', title: 'courseId' },
            { id: 'classOptionId', title: 'classOptionId' },
            { id: 'classCancel', title: 'classCancel' },
            { id: 'payment', title: 'payment' },
            { id: 'status', title: 'status' },
            { id: 'teacherId', title: 'teacherId' },
            { id: 'InvoiceDone', title: 'InvoiceDone' },
            { id: 'packageGroupId', title: 'packageGroupId' },
            { id: 'sourceImage', title: 'sourceImage' },
        ],
    });
    await sessionsWriter.writeRecords(sessions);

    // Save updated courses
    saveCourses(courses);
    console.log(`✅ Updated courses_master.csv (${courses.length} total courses)`);
}

// ============================================================
// ENTRY POINT
// ============================================================

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     Google Document AI OCR Ingestion Script                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log(`📋 Log file: ${LOG_FILE}\n`);

    // Check if specific folder requested
    const args = process.argv.slice(2);
    const targetFolder = args[0];

    if (targetFolder) {
        console.log(`📁 Processing specific folder: ${targetFolder}\n`);
        await processYearFolder(targetFolder);
    } else {
        // Process all year folders
        const yearFolders = fs.readdirSync(ROOT_DIR, { withFileTypes: true })
            .filter(entry => entry.isDirectory() && /^\d{4}(-\d{4})?$/.test(entry.name))
            .map(entry => entry.name)
            .sort();

        if (yearFolders.length === 0) {
            console.log('⚠️  No year folders found (e.g., 2019, 2020-2021)');
            process.exit(0);
        }

        console.log(`📁 Found ${yearFolders.length} year folders: ${yearFolders.join(', ')}\n`);

        for (const folder of yearFolders) {
            await processYearFolder(folder);
        }
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║     ✅ Processing Complete!                                   ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`\n📂 Output location: ${OUTPUT_BASE_DIR}`);
    console.log(`📋 Full log: ${LOG_FILE}`);

    logFileStream.end();
}

main().catch(error => {
    console.error('Fatal error:', error);
    logFileStream.end();
    process.exit(1);
});
