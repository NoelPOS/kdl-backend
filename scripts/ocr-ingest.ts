// import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import * as fs from 'fs';
import * as path from 'path';
import * as heicConvert from 'heic-convert';
import { createObjectCsvWriter } from 'csv-writer';
import { parse } from 'csv-parse/sync';
import { spawn } from 'child_process';

// --- Configuration ---
const INPUT_FOLDER = path.join(__dirname, '../../2019'); // Adjust if folder is elsewhere
const DATA_DIR = path.join(__dirname, '../src/database/seeders/data'); // Where your CSVs live

const STUDENTS_CSV = path.join(DATA_DIR, 'students.csv');
const PARENTS_CSV = path.join(DATA_DIR, 'parents.csv');
const SESSIONS_CSV = path.join(DATA_DIR, 'sessions.csv');
const COURSES_CSV = path.join(__dirname, '../../courses_2025.csv'); // Using the new courses file

// Point to the new location in ocr-service
const PYTHON_SCRIPT = path.join(__dirname, '../ocr-service/main.py');
// Point to the venv python executable
const PYTHON_EXE = path.join(__dirname, '../ocr-service/venv/Scripts/python.exe');

interface ExtractedData {
    sourceImage?: string;
    studentId?: string;
    studentName?: string;
    nickname?: string;
    dob?: string;
    sex?: string;
    parentName?: string;
    mobile?: string;
    courseTitle?: string;
    teacherName?: string;
}

// --- Helper: Read Existing CSVs to Avoid Duplicates ---
function readCsvIds(filePath: string, idColumn: string): Set<string> {
    if (!fs.existsSync(filePath)) return new Set();
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    return new Set(records.map((r: any) => r[idColumn]));
}

function readCourses(filePath: string): any[] {
     if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    return parse(content, { columns: true, skip_empty_lines: true });
}

// --- Helper: Run Python OCR ---
async function runPythonOCR(imagePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        // Use the venv python executable
        const pythonProcess = spawn(PYTHON_EXE, [PYTHON_SCRIPT, imagePath]);
        
        let dataString = '';
        let errorString = '';

        pythonProcess.stdout.on('data', (data) => {
            dataString += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            console.error(`[Python Result]: ${msg}`); 
            errorString += msg;
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python script exited with code ${code}: ${errorString}`));
            } else {
                resolve(dataString);
            }
        });
    });
}

// --- Core Logic ---

async function processImage(filePath: string): Promise<ExtractedData | null> {
    console.log(`\nProcessing: ${path.basename(filePath)}`);
    
    // 1. Image Pre-processing (HEIC -> JPG)
    // PaddleOCR can handle standard formats, so we ensure we pass a JPG/PNG path.
    // If it's HEIC, we convert to a temp JPG file.
    let targetPath = filePath;
    let tempFileCreated = false;

    try {
        const ext = path.extname(filePath).toLowerCase();
        
        if (ext === '.heic') {
            console.log(" Converting HEIC to JPEG...");
            const fileBuffer = fs.readFileSync(filePath);
            const imageBytes = await heicConvert({
                buffer: fileBuffer,
                format: 'JPEG',
                quality: 1
            });
            
            // Write temp file for Python to read
            targetPath = path.join(__dirname, `temp_${Date.now()}.jpg`);
            fs.writeFileSync(targetPath, imageBytes);
            tempFileCreated = true;
        }
    } catch (err) {
        console.error(`Error reading/converting image: ${err.message}`);
        return null;
    }

    // 2. Local PaddleOCR
    let rawText = "";
    let jsonResult = ""; 
    try {
        jsonResult = await runPythonOCR(targetPath);
        const parsedResult = JSON.parse(jsonResult);
        
        if (parsedResult.error) {
            console.error(`OCR Error: ${parsedResult.error}`);
            return null;
        }

        // Convert structured JSON back to "lines" for our regex logic
        // or iterate directly. For now, joining by newline keeps regex logic compatible.
        rawText = parsedResult.map((item: any) => item.text).join('\n');
        
        // console.log("--- Raw Text Detected ---");
        // console.log(rawText);
        
    } catch (err) {
        console.error(`OCR Execution Error: ${err.message}`);
        if (jsonResult) console.error(`Raw Output: ${jsonResult.substring(0, 500)}...`);
        return null;
    } finally {
        if (tempFileCreated && fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath); // Clean up
        }
    }

    // 3. Extraction with Regex (Focused on Header)
    const data: ExtractedData = {
        sourceImage: path.basename(filePath)
    };

    // Student ID: 202103001
    const idMatch = rawText.match(/Student ID[:\s]+(\d+)/i);
    if (idMatch) data.studentId = idMatch[1];

    // Student Name: Siri
    const nameMatch = rawText.match(/Student Name[:\s]+(.+)/i);
    if (nameMatch) data.studentName = nameMatch[1].trim();

    // Nickname: Siri
    const nickMatch = rawText.match(/Nickname[:\s]+(.+)/i);
    if (nickMatch) data.nickname = nickMatch[1].trim();

    // DOB: 08-Nov-16
    const dobMatch = rawText.match(/Date of Birth[:\s]+(.+)/i);
    if (dobMatch) data.dob = dobMatch[1].trim();

    // Sex: Female
    const sexMatch = rawText.match(/Sex[:\s]+(Male|Female)/i);
    if (sexMatch) data.sex = sexMatch[1];

    // Parent Name: K.Bank
    const parentMatch = rawText.match(/Parent Name[:\s]+(.+)/i);
    if (parentMatch) data.parentName = parentMatch[1].trim();

    // Mobile: 092 545 5555
    const mobileMatch = rawText.match(/Mobile[:\s]+([\d\s]+)/i);
    if (mobileMatch) data.mobile = mobileMatch[1].replace(/\s/g, ''); // Clean spaces

    // Course Title: Found usually in a header line like "Course PK-Tinkamo..."
    // Strategy: Look for line starting with "Course"
    const courseLine = rawText.split('\n').find(line => line.toLowerCase().startsWith('course'));
    if (courseLine) {
        // Remove "Course " prefix and "(at home)" suffix if present
        data.courseTitle = courseLine.replace(/^Course\s+/i, '').replace(/\(at home\)/i, '').trim();
    }

    // Teacher: Look for column header "Teacher" and take value below it? 
    // Or sometimes it's written "Teacher: Sea"
    // Heuristic: Look for "Teacher" and capture next word or line content? 
    // In your image, it's a table column. 
    // Simple heuristic: Search for common teacher names or just log it for now.
    // For now, let's leave teacher generic or look for a specific known teacher list.
    
    return data;
}

// --- Writer ---

async function main() {
    if (!fs.existsSync(INPUT_FOLDER)) {
        console.error(`Input folder not found: ${INPUT_FOLDER}`);
        return;
    }

    const files = fs.readdirSync(INPUT_FOLDER).filter(f => ['.jpg', '.jpeg', '.png', '.heic'].includes(path.extname(f).toLowerCase()));
    
    // Load existing Data for checks
    const existingStudentIds = readCsvIds(STUDENTS_CSV, 'studentId');
    const existingParents = readCsvIds(PARENTS_CSV, 'name'); 
    const allCourses = readCourses(COURSES_CSV);

    const newStudents = [];
    const newParents = [];
    const newParentNames = new Set<string>();
    const newSessions = [];
    const coursesToAppend = [];

    // Helper: Valid Name Check
    const isBadName = (name) => {
        if (!name || name.length < 3) return true;
        const lower = name.toLowerCase();
        // Reject extracted labels
        const badKeywords = [
            'sex', 'sex:', 'mobile', 'mobile:', 'date', 'parent', 'student', 'gender', 
            'gender:', 'name', 'name:', 'birth', 'birth:', 'id:', 'id', 'course', 'teacher'
        ];
        if (badKeywords.some(k => lower.includes(k))) return true;
        
        // Reject if purely numeric or special chars
        if (/^[\d\W]+$/.test(name)) return true;

        return false;
    };

    // Helper: Clean Phone
    const cleanPhone = (raw) => {
         if (!raw) return '';
         // Remove non-digits
         let digits = raw.replace(/\D/g, '');
         // If looks like two numbers merged (e.g. 081...089...), take the first 10
         if (digits.length > 12 && digits.startsWith('0')) { 
             return digits.substring(0, 10);
         }
         return digits;
    };

    // Helper: Clean DOB (DD-MMM-YY -> YYYY-MM-DD)
    const cleanDob = (raw) => {
        if (!raw) return '';
        // Expected format: 06-May-16 or 6-May-16
        // Regex to capture parts
        const parts = raw.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2})/);
        if (!parts) return raw; // Return raw if regex fails (user can fix manually)

        const day = parts[1].padStart(2, '0');
        const monthStr = parts[2].toLowerCase();
        const yearShort = parts[3];
        const year = '20' + yearShort; // Assume 20xx

        const monthMap = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
            'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        };

        const month = monthMap[monthStr] || '01'; // Default to Jan if parse fails? Or maybe null
        
        return `${year}-${month}-${day}`;
    };

    for (const file of files) {
        const data = await processImage(path.join(INPUT_FOLDER, file));
        if (!data) continue;

        console.log("Extracted:", data);

        // --- VALIDATION & CLEANUP ---
        
        // 1. Validate Student ID
        if (!data.studentId || data.studentId.length < 4) {
            console.warn(`Skipping ${file}: Invalid Student ID '${data.studentId}'`);
            continue;
        }
        
        // 2. Duplication Check
        if (existingStudentIds.has(data.studentId)) {
            console.log(`Skipping ${data.studentId}: Already exists in DB.`);
            continue;
        }

        // 3. Name Cleaning
        if (isBadName(data.studentName)) {
             console.warn(`Skipping Bad Student Name: '${data.studentName}'`);
             data.studentName = ''; 
        }
        
        data.mobile = cleanPhone(data.mobile);
        
        // 4. DOB Cleaning
        data.dob = cleanDob(data.dob);
        
        if (isBadName(data.parentName)) {
            data.parentName = '';
        }

        // -----------------------------

        // 1. Student Logic
        if (data.studentId && data.studentName) {
             newStudents.push({
                studentId: data.studentId,
                name: data.studentName,
                nickname: data.nickname || '',
                dob: data.dob || '',
                gender: data.sex || '',
                phone: data.mobile || '',
                sourceImage: data.sourceImage || '', 
                // Defaults
                school: '', allergic: '', doNotEat: '', adConcent: 'FALSE', profilePicture: '', profileKey: ''
            });
            // Mark as added to prevent re-adding in same run if dupes in folder
            existingStudentIds.add(data.studentId);
        }

        // 2. Parent Logic
        if (data.parentName) {
            if (!existingParents.has(data.parentName) && !newParentNames.has(data.parentName)) {
                newParents.push({
                    name: data.parentName,
                    contactNo: data.mobile || '',
                    sourceImage: data.sourceImage || '',
                    // Defaults
                    email: '', lineId: '', address: '', profilePicture: '', profileKey: ''
                });
                newParentNames.add(data.parentName);
            }
        }

        // 3. Session Logic
        // Find Course ID
        let courseId = '';
        if (data.courseTitle) {
            // Simple fuzzy match: Does any course title contain this text?
            const match = allCourses.find(c => c.title.toLowerCase().includes(data.courseTitle.toLowerCase()) || data.courseTitle.toLowerCase().includes(c.title.toLowerCase()));
            if (match) {
                courseId = match.id;
                console.log(`Matched Course: '${data.courseTitle}' -> ID ${courseId} (${match.title})`);
            } else {
                console.warn(`Matching failed for: '${data.courseTitle}'. Creating new course...`);
                // Generate new ID (simple increment)
                // Assuming IDs are numeric. If string, we might need a better strategy. 
                // Let's assume numeric based on seeder? 
                // Actually CSV IDs are strings usually. Let's try to parse max ID.
                const maxId = allCourses.reduce((max, c) => Math.max(max, parseInt(c.id) || 0), 0);
                const newId = (maxId + 1).toString();
                
                const newCourse = {
                    id: newId,
                    title: data.courseTitle,
                    description: 'Imported from OCR',
                    ageRange: 'TBD',
                    medium: 'TBD'
                };
                
                coursesToAppend.push(newCourse);
                allCourses.push(newCourse); // Add to in-memory list for future matches this run
                courseId = newId;
                console.log(`Created New Course: '${data.courseTitle}' -> ID ${newId}`);
            }
        }

        if (data.studentId && courseId) {
             newSessions.push({
                 studentId: data.studentId, // We technically need internal DB ID, but seeder can handle mapping if we run it smart.
                 // Actually, seeder usually expects internal IDs.
                 // For this script to work perfectly, we might need to query the DB or generate UUIDs.
                 // For now, let's output the raw links and we can refine the seeding Step.
                 courseId: courseId,
                 classOptionId: 1, // Default?
                 teacherId: 1, // Default or extracted
                 status: 'wip',
                 payment: 'Paid',
                 sourceImage: data.sourceImage || ''
             });
        }
    }

    // Append to CSVs
    if (newStudents.length > 0) {
        const writer = createObjectCsvWriter({
            path: STUDENTS_CSV,
            header: [
                {id: 'name', title: 'name'},
                {id: 'nickname', title: 'nickname'},
                {id: 'studentId', title: 'studentId'},
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
            append: true
        });
        await writer.writeRecords(newStudents);
        console.log(`Appended ${newStudents.length} students to ${STUDENTS_CSV}`);
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
            append: true
        });
        await writer.writeRecords(newParents);
        console.log(`Appended ${newParents.length} parents to ${PARENTS_CSV}`);
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
                {id: 'sourceImage', title: 'sourceImage'}
            ],
            append: true
        });
        await writer.writeRecords(newSessions);
        console.log(`Appended ${newSessions.length} sessions to ${SESSIONS_CSV}`);
    }
    
    // Note: ParentStudent Relations logic
    // Usually we need a separate CSV for this if it's many-to-many.
    // For now, I'll log it or creating a simple link file if needed.
    const parentStudentRelations = [];
    for (let i = 0; i < newStudents.length && i < newParents.length; i++) {
         if (newStudents[i].studentId && newParents[i].name) {
             parentStudentRelations.push({
                 studentId: newStudents[i].studentId,
                 parentName: newParents[i].name
             });
         }
    }

    if (parentStudentRelations.length > 0) {
        const relationCsv = path.join(DATA_DIR, 'parent_students.csv');
        const writer = createObjectCsvWriter({
            path: relationCsv,
            header: [
                {id: 'parentName', title: 'parentName'},
                {id: 'studentId', title: 'studentId'}
            ],
            append: true
        });
        await writer.writeRecords(parentStudentRelations);
        console.log(`Appended ${parentStudentRelations.length} relations to ${relationCsv}`);
    }
    if (coursesToAppend.length > 0) {
        const writer = createObjectCsvWriter({
            path: COURSES_CSV,
            header: [
                {id: 'id', title: 'id'},
                {id: 'title', title: 'title'},
                {id: 'description', title: 'description'},
                {id: 'ageRange', title: 'ageRange'},
                {id: 'medium', title: 'medium'}
            ],
            append: true
        });
        await writer.writeRecords(coursesToAppend);
        console.log(`Appended ${coursesToAppend.length} new courses to ${COURSES_CSV}`);
    }
}

// Run
main();
