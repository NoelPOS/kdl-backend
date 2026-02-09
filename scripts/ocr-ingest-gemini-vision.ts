/**
 * Gemini Vision OCR Ingestion Script
 *
 * Uses Gemini Vision + Structured Output as the primary extractor for KIDDEE LAB
 * registration forms. Single API call per image; native Thai support, no Form Parser.
 *
 * Usage:
 *   npx ts-node scripts/ocr-ingest-gemini-vision.ts 2019
 *   npx ts-node scripts/ocr-ingest-gemini-vision.ts 2019 --limit 3
 *   npx ts-node scripts/ocr-ingest-gemini-vision.ts 2019 --image IMG_7483
 *   npx ts-node scripts/ocr-ingest-gemini-vision.ts 2019 --rerun-failures
 *   npx ts-node scripts/ocr-ingest-gemini-vision.ts 2019 --failures-from-output
 *   npx ts-node scripts/ocr-ingest-gemini-vision.ts  (all year folders)
 *
 * Failures: Skipped images are written to ocr-output-gemini/<year>/failures.csv.
 * Rerun only those with: ... <year> --rerun-failures (appends to existing CSVs).
 * --failures-from-output: no OCR. Diff jpg-cache vs students.csv sourceImage, write
 *   missing images to failures.csv (e.g. for 2019 when you didn't run with failure tracking).
 *
 * Uses existing jpg-cache only (no HEIC conversion). Run other ingest to build cache if needed.
 *
 * Requires: GEMINI_API_KEY (and optionally GEMINI_API_KEY_2, GEMINI_API_KEY_3).
 * On 429 rate limit, the script rotates to the next key and retries.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { parse } from 'csv-parse/sync';
import * as util from 'util';
import * as sharp from 'sharp';

// ============================================================
// CONFIGURATION
// ============================================================

const ROOT_DIR = path.join(__dirname, '../..');
const OUTPUT_BASE_DIR = path.join(ROOT_DIR, 'ocr-output-gemini');
const LOG_FILE = path.join(
  ROOT_DIR,
  `ocr-log-gemini-vision-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`,
);
const MASTER_COURSES_CSV = path.join(ROOT_DIR, 'courses_master.csv');

const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean) as string[];

const GEMINI_MODEL = 'gemini-2.0-flash';

let lastApiCall = 0;
let currentKeyIndex = 0;
// Rate limit: 12 seconds between calls = ~5 images per minute (safe for free tier)
const API_RATE_LIMIT_MS = 12000;

const FAILURES_FROM_OUTPUT = process.argv.includes('--failures-from-output');
if (!GEMINI_API_KEYS.length && !FAILURES_FROM_OUTPUT) {
  console.error(
    '❌ No Gemini API keys! Set GEMINI_API_KEY (and optionally _2, _3) in backend.env',
  );
  process.exit(1);
}

// Logging
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

interface FormExtract {
  studentId: string;
  studentName: string;
  nickname: string;
  school: string;
  sex: string;
  dateOfBirth: string;
  parentName: string;
  mobile: string;
  courseTitle: string;
  teacherName: string;
}

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
// GEMINI VISION + STRUCTURED OUTPUT
// ============================================================

const EXTRACT_PROMPT = `You are extracting data from a KIDDEE LAB student registration form (mixed Thai and English).

IMPORTANT RULES:
1. If image is rotated, read it in the correct orientation.
2. Some forms have handwritten corrections/scratches - use the final corrected value.
3. Use empty string "" for any field not clearly visible or not filled in. Do not guess.
4. Some forms only have Student ID, Nickname, and Sex filled in - that's OK, leave other fields blank.

Extract these fields:

- Student ID: numeric id like 201902015

- Student Name: full name in Thai script (e.g. ด.ญ. กัญญ์ชิชา). Include titles like ด.ญ., ด.ช., เด็กหญิง, เด็กชาย if present.
  If blank or empty, use "" (we will fallback to nickname later).

- Nickname: Thai or English nickname (e.g. "ออม", "Beam", "ฟ้า")

- School: school name if present, otherwise ""

- Sex: "Female" or "Male" only

- Date of Birth: Extract EXACTLY as written on the form. Examples:
  - "17-Jun-12" or "5-Mar-15" (DD-MMM-YY format)
  - "10 yrs" or "7 ปี" or "8.6 ปี" (age format - keep as-is, we will convert later)
  - "12/05/2012" (date format)
  - If blank, use ""

- Parent Name: full Thai name (e.g. "คุณนลิน", "คุณแม่ปู"). Read Thai script carefully.
  May include notes like "(อาม่า)" or "(ยาย)" - include them.

- Mobile: If multiple phone numbers exist, extract ONLY THE FIRST one.
  Format: 10 digits like 0891234567. Ignore second/third numbers.

- Course Title: CRITICAL - If the form has MULTIPLE tables/courses, extract ONLY THE FIRST course name.
  Look for table headers like "K-B3", "C-B1", "General Python", "Arduino I".
  Do NOT include prefixes like "Course:", "Course ", "Summer Course " - just the course name.
  Do NOT include suffixes like "(ENG)", "(Thai)", "(at home)" - strip them.
  Example: "Course C-B1 (ENG)" → "C-B1"

- Teacher Name: if shown, otherwise ""

Return empty string "" for any field not found or not legible.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    studentId: { type: 'string', description: 'Student ID e.g. 201902015' },
    studentName: {
      type: 'string',
      description: 'Full student name, Thai or English',
    },
    nickname: { type: 'string', description: 'Nickname' },
    school: { type: 'string', description: 'School name' },
    sex: { type: 'string', description: 'Female or Male' },
    dateOfBirth: { type: 'string', description: 'Date of birth as on form' },
    parentName: { type: 'string', description: 'Parent or guardian name' },
    mobile: { type: 'string', description: 'Primary mobile number' },
    courseTitle: { type: 'string', description: 'Course name e.g. K-B3, C-B1' },
    teacherName: { type: 'string', description: 'Teacher name if present' },
  },
  required: [
    'studentId',
    'studentName',
    'nickname',
    'school',
    'sex',
    'dateOfBirth',
    'parentName',
    'mobile',
    'courseTitle',
    'teacherName',
  ],
  // Gemini 2.0 requires propertyOrdering
  propertyOrdering: [
    'studentId',
    'studentName',
    'nickname',
    'school',
    'sex',
    'dateOfBirth',
    'parentName',
    'mobile',
    'courseTitle',
    'teacherName',
  ],
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractFormWithGemini(
  imageBuffer: Buffer,
): Promise<FormExtract | null> {
  const now = Date.now();
  const elapsed = now - lastApiCall;
  if (elapsed < API_RATE_LIMIT_MS) {
    await sleep(API_RATE_LIMIT_MS - elapsed);
  }
  lastApiCall = Date.now();

  // Round-robin: use next key for this image, advance for next image (spreads load across projects)
  let keyIndex = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
  let key = GEMINI_API_KEYS[keyIndex];
  const keyLabel =
    GEMINI_API_KEYS.length > 1
      ? ` (key ${keyIndex + 1}/${GEMINI_API_KEYS.length})`
      : '';

  const base64 = imageBuffer.toString('base64');
  const body = {
    contents: [
      {
        parts: [
          { text: EXTRACT_PROMPT },
          { inline_data: { mime_type: 'image/jpeg', data: base64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 512,
      temperature: 0,
    },
  };

  const backoffSeconds = [10, 20, 30, 60, 90, 120];
  let attempt = 0;
  let non429Retries = 0;
  const maxNon429Retries = 3;

  while (true) {
    attempt++;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (res.status === 429) {
        const wait =
          (backoffSeconds[Math.min(attempt - 1, backoffSeconds.length - 1)] ??
            120) * 1000;
        // Rotate to next key on 429 before retrying
        currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
        const nextKey = GEMINI_API_KEYS[currentKeyIndex];
        console.log(
          `    ⏳ Rate limited on key ${keyIndex + 1} → switching to key ${currentKeyIndex + 1}, wait ${wait / 1000}s, retry #${attempt}`,
        );
        keyIndex = currentKeyIndex;
        key = nextKey;
        await sleep(wait);
        lastApiCall = Date.now();
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const data: any = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!raw) throw new Error('No text in response');

      const parsed = JSON.parse(raw) as FormExtract;
      const hasName = !!(parsed.studentName?.trim() || parsed.nickname?.trim());
      if (!parsed.studentId?.trim() || !hasName) {
        throw new Error(
          'Gemini omitted studentId or both studentName and nickname',
        );
      }
      return parsed;
    } catch (e: any) {
      const isRateLimit = e?.message?.includes('429');
      if (isRateLimit) {
        const wait =
          (backoffSeconds[Math.min(attempt - 1, backoffSeconds.length - 1)] ??
            120) * 1000;
        console.log(
          `    ⏳ Rate limited → wait ${wait / 1000}s, retry #${attempt} (no skip)${keyLabel}`,
        );
        await sleep(wait);
        lastApiCall = Date.now();
        continue;
      }
      non429Retries++;
      if (non429Retries > maxNon429Retries) {
        console.log(
          `    ❌ Gemini extraction failed (skipping): ${e?.message ?? e}`,
        );
        return null;
      }
      const wait = 5000 * non429Retries;
      console.log(
        `    ⚠️  Retry ${non429Retries}/${maxNon429Retries} in ${wait / 1000}s: ${e?.message ?? e}`,
      );
      await sleep(wait);
      lastApiCall = Date.now();
    }
  }
}

function formExtractToData(
  ext: FormExtract,
  sourceImage: string,
): ExtractedData {
  let mobile = (ext.mobile ?? '').trim();
  if (mobile) {
    const m = mobile.match(/(\d[\d\s\-]{8,}\d)/);
    if (m) mobile = m[1].replace(/[\s\-]/g, '');
  }
  let courseTitle = (ext.courseTitle ?? '').trim();
  if (courseTitle) {
    courseTitle = courseTitle
      .replace(/^Course\s+/i, '')
      .replace(/\s*\([^)]+\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const studentName = ext.studentName?.trim() || undefined;
  const nickname = ext.nickname?.trim() || undefined;
  return {
    sourceImage,
    studentId: ext.studentId?.trim() || undefined,
    studentName: studentName || nickname || undefined,
    nickname: nickname || undefined,
    school: ext.school?.trim() || undefined,
    dob: ext.dateOfBirth?.trim() || undefined,
    sex: ext.sex?.trim() || undefined,
    parentName: ext.parentName?.trim() || undefined,
    mobile: mobile || undefined,
    courseTitle: courseTitle || undefined,
    teacherName: ext.teacherName?.trim() || undefined,
  };
}

// ============================================================
// JPG CACHE (use existing only — no HEIC conversion)
// ============================================================
// Cached files are named like IMG_7433.HEIC.jpg, IMG_7434.HEIC.jpg
// (HEIC filename + ".jpg"). We only use these; no conversion.

function getJpgPaths(yearPath: string): string[] {
  const cacheDir = path.join(yearPath, 'jpg-cache');
  if (!fs.existsSync(cacheDir)) return [];
  const jpgs = fs
    .readdirSync(cacheDir)
    .filter((f) => f.toLowerCase().endsWith('.heic.jpg'))
    .sort();
  return jpgs.map((f) => path.join(cacheDir, f));
}

/** Build failures.csv from output only (no OCR). Images in jpg-cache but not in students.csv sourceImage. */
async function buildFailuresFromOutput(yearFolder: string): Promise<void> {
  const yearPath = path.join(ROOT_DIR, yearFolder);
  const outputDir = path.join(OUTPUT_BASE_DIR, yearFolder);
  const failuresPath = path.join(outputDir, 'failures.csv');
  const studentsPath = path.join(outputDir, 'students.csv');

  if (!fs.existsSync(studentsPath)) {
    console.log(`⚠️  No students.csv at ${outputDir}; nothing to diff.`);
    return;
  }

  const allJpgs = getJpgPaths(yearPath);
  if (!allJpgs.length) {
    console.log(`⚠️  No JPGs in ${yearFolder}/jpg-cache.`);
    return;
  }

  const rows = parse(fs.readFileSync(studentsPath, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
  }) as { sourceImage?: string }[];
  const successNames = new Set(
    rows.map((r) => (r.sourceImage || '').trim()).filter(Boolean),
  );

  const failed: { imageName: string; reason: string }[] = [];
  for (const p of allJpgs) {
    const base = path.basename(p);
    if (!successNames.has(base)) {
      failed.push({ imageName: base, reason: 'not in output' });
    }
  }

  if (!failed.length) {
    console.log(
      `✅ All ${allJpgs.length} jpg-cache images appear in students.csv; no failures.`,
    );
    if (fs.existsSync(failuresPath)) fs.unlinkSync(failuresPath);
    return;
  }

  const w = createObjectCsvWriter({
    path: failuresPath,
    encoding: 'utf8',
    header: [
      { id: 'imageName', title: 'imageName' },
      { id: 'reason', title: 'reason' },
    ],
  });
  await w.writeRecords(failed);
  console.log(
    `📋 Wrote ${failed.length} failure(s) → ${path.join(yearFolder, 'failures.csv')} (rerun with: ... ${yearFolder} --rerun-failures)`,
  );
}

// ============================================================
// COURSE MATCHING
// ============================================================

function loadCourses(): any[] {
  if (!fs.existsSync(MASTER_COURSES_CSV)) return [];
  const content = fs.readFileSync(MASTER_COURSES_CSV, 'utf-8');
  return parse(content, { columns: true, skip_empty_lines: true });
}

function findOrCreateCourse(
  courseTitle: string,
  courses: any[],
): { courseId: number; isNew: boolean } {
  if (!courseTitle) return { courseId: 0, isNew: false };

  const normalized = courseTitle.trim().toLowerCase();
  let course = courses.find(
    (c: any) => (c.title || '').toLowerCase() === normalized,
  );
  if (course) {
    const courseId = parseInt(course.id || course.courseId);
    if (!isNaN(courseId)) return { courseId, isNew: false };
  }

  course = courses.find((c: any) => {
    const t = (c.title || '').toLowerCase();
    return (
      t.startsWith(normalized) ||
      t === normalized ||
      t.replace(/\s+/g, '') === normalized.replace(/\s+/g, '')
    );
  });
  if (course) {
    const courseId = parseInt(course.id || course.courseId);
    if (!isNaN(courseId)) {
      console.log(
        `    🔍 Fuzzy matched course: ${courseTitle} → ${course.title}`,
      );
      return { courseId, isNew: false };
    }
  }

  const existingIds = courses
    .map((c: any) => parseInt(c.id || c.courseId))
    .filter((id: number) => !isNaN(id));
  const newId = existingIds.length ? Math.max(...existingIds) + 1 : 1;
  courses.push({
    id: String(newId),
    courseId: String(newId),
    title: courseTitle,
    type: '',
    yearPeriod: '',
    maxStudent: '',
    level: '',
    category: '',
    ages: '',
  });
  console.log(`    ➕ Created new course: ${courseTitle} → ${newId}`);
  return { courseId: newId, isNew: true };
}

async function saveCourses(courses: any[]): Promise<void> {
  const w = createObjectCsvWriter({
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
  await w.writeRecords(courses);
}

// ============================================================
// MAIN PROCESSING
// ============================================================

async function processYearFolder(yearFolder: string): Promise<void> {
  console.log('\n============================================================');
  console.log(`📅 Processing Year: ${yearFolder} (Gemini Vision)`);
  console.log('============================================================');

  const yearPath = path.join(ROOT_DIR, yearFolder);
  const outputDir = path.join(OUTPUT_BASE_DIR, yearFolder);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const rerunFailures = process.argv.includes('--rerun-failures');
  const failuresPath = path.join(outputDir, 'failures.csv');

  let students: StudentRecord[] = [];
  let sessions: SessionRecord[] = [];
  let parents: ParentRecord[] = [];
  const failures: { imageName: string; reason: string }[] = [];
  const seenStudentIds = new Set<string>();
  let sessionId = 1;
  let parentId = 1;
  let jpgPaths: string[] = [];
  let courses = loadCourses();

  if (rerunFailures) {
    if (!fs.existsSync(failuresPath)) {
      console.log('⚠️  No failures.csv found; nothing to rerun.');
      return;
    }
    const failureRows = parse(fs.readFileSync(failuresPath, 'utf-8'), {
      columns: true,
      skip_empty_lines: true,
    }) as { imageName: string; reason: string }[];
    const failureNames = new Set(
      failureRows.map((r) => (r.imageName || '').trim()).filter(Boolean),
    );
    if (!failureNames.size) {
      console.log('⚠️  failures.csv is empty; nothing to rerun.');
      return;
    }
    console.log(
      `🔄 Rerun mode: ${failureNames.size} failed image(s) from failures.csv`,
    );
    // Load existing CSVs so we append instead of overwrite
    const sp = path.join(outputDir, 'students.csv');
    const pp = path.join(outputDir, 'parents.csv');
    const sesp = path.join(outputDir, 'sessions.csv');
    if (fs.existsSync(sp)) {
      students = parse(fs.readFileSync(sp, 'utf-8'), {
        columns: true,
        skip_empty_lines: true,
      }) as StudentRecord[];
      students.forEach((s) => seenStudentIds.add((s as any).studentId));
    }
    if (fs.existsSync(pp)) {
      parents = parse(fs.readFileSync(pp, 'utf-8'), {
        columns: true,
        skip_empty_lines: true,
      }) as ParentRecord[];
      const maxP = parents.reduce(
        (m, p) => Math.max(m, +(p as any).parentId || 0),
        0,
      );
      parentId = maxP + 1;
    }
    if (fs.existsSync(sesp)) {
      sessions = parse(fs.readFileSync(sesp, 'utf-8'), {
        columns: true,
        skip_empty_lines: true,
      }) as SessionRecord[];
      const maxS = sessions.reduce(
        (m, s) => Math.max(m, +(s as any).sessionId || 0),
        0,
      );
      sessionId = maxS + 1;
    }
    // Filter jpgPaths to failure images only
    let allJpgs = getJpgPaths(yearPath);
    allJpgs = allJpgs.filter((p) => {
      const base = path.basename(p);
      return (
        failureNames.has(base) ||
        failureNames.has(base.replace(/\.heic\.jpg$/i, ''))
      );
    });
    if (!allJpgs.length) {
      console.log('⚠️  No matching JPGs in jpg-cache for failure list.');
      return;
    }
    jpgPaths = allJpgs;
    console.log(`📸 Queue: ${jpgPaths.length} images (rerun from failures)`);
  } else {
    ['students.csv', 'sessions.csv', 'parents.csv'].forEach((f) => {
      const fp = path.join(outputDir, f);
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
        console.log(`🧹 Cleared old ${f}`);
      }
    });
    jpgPaths = getJpgPaths(yearPath);

    const limitIdx = process.argv.indexOf('--limit');
    const limit =
      limitIdx >= 0 && process.argv[limitIdx + 1]
        ? parseInt(process.argv[limitIdx + 1], 10)
        : 0;
    const imageIdx = process.argv.indexOf('--image');
    const imageName =
      imageIdx >= 0 && process.argv[imageIdx + 1]
        ? process.argv[imageIdx + 1]
        : '';

    if (imageName) {
      const base = imageName.replace(/\.(heic|jpg|jpeg)$/i, '').toLowerCase();
      jpgPaths = jpgPaths.filter((p) => {
        const name = path.basename(p).toLowerCase();
        return (
          name.startsWith(base) ||
          name.replace(/\.heic\.jpg$/, '').startsWith(base)
        );
      });
      if (jpgPaths.length)
        console.log(`⚠️  Filtering to image: ${path.basename(jpgPaths[0])}`);
    } else if (limit > 0) {
      jpgPaths = jpgPaths.slice(0, limit);
      console.log(`⚠️  Limiting to first ${limit} images`);
    }

    if (!jpgPaths.length) {
      console.log(
        '⚠️  No JPGs in jpg-cache (use existing cache only; no conversion)',
      );
      return;
    }
    console.log(`📸 Queue: ${jpgPaths.length} images (from jpg-cache)`);
  }

  for (let i = 0; i < jpgPaths.length; i++) {
    const jpgPath = jpgPaths[i];
    const jpgName = path.basename(jpgPath);
    console.log(`  [${i + 1}/${jpgPaths.length}] Processing: ${jpgName}`);

    try {
      let imageBuffer = fs.readFileSync(jpgPath);
      imageBuffer = await sharp(imageBuffer)
        .rotate()
        .jpeg({ quality: 90 })
        .toBuffer();

      const form = await extractFormWithGemini(imageBuffer);
      if (!form) {
        console.log(`    ⚠️  Skipping (Gemini extraction failed)`);
        failures.push({
          imageName: jpgName,
          reason: 'Gemini extraction failed',
        });
        continue;
      }

      const data = formExtractToData(form, jpgName);
      // Only require studentId - forms may only have ID + nickname + sex
      if (!data.studentId) {
        console.log(`    ⚠️  missing studentId - skipping`);
        failures.push({ imageName: jpgName, reason: 'missing studentId' });
        continue;
      }

      // Use nickname as name fallback
      const finalName = data.studentName || data.nickname || '';
      const displayName = finalName || '(no name)';
      console.log(`    ✅ Extracted: ${data.studentId} - ${displayName}`);

      const isNewStudent = !seenStudentIds.has(data.studentId);
      if (isNewStudent) {
        seenStudentIds.add(data.studentId);

        let gender = '';
        if (data.sex) {
          const s = data.sex.toLowerCase();
          if (s.startsWith('m')) gender = 'Male';
          if (s.startsWith('f')) gender = 'Female';
        }

        // Enhanced DOB parsing with age conversion
        let dob = '';
        if (data.dob) {
          const rawDob = data.dob.trim();
          
          // Pattern 1: DD-MMM-YY (e.g., "17-Jun-12" → 2012-06-17)
          const monthMap: Record<string, string> = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
            'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
          };
          const mmm = rawDob.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2})/);
          if (mmm) {
            const day = mmm[1].padStart(2, '0');
            const mon = monthMap[mmm[2].toLowerCase()] || '01';
            const yr = parseInt(mmm[3]) > 50 ? '19' + mmm[3] : '20' + mmm[3];
            dob = `${yr}-${mon}-${day}`;
          }
          
          // Pattern 2: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
          if (!dob) {
            const numeric = rawDob.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
            if (numeric) {
              let d = numeric[1].padStart(2, '0');
              let mo = numeric[2].padStart(2, '0');
              let y = numeric[3];
              if (y.length === 2) y = parseInt(y) > 50 ? '19' + y : '20' + y;
              dob = `${y}-${mo}-${d}`;
            }
          }
          
          // Pattern 3: Age format (e.g., "10 yrs", "7 ปี", "8.6 ปี") → calculate birth year
          if (!dob) {
            const ageMatch = rawDob.match(/(\d+(?:\.\d+)?)\s*(?:yrs?|years?|ปี)/i);
            if (ageMatch) {
              const age = Math.floor(parseFloat(ageMatch[1]));
              // Extract year from folder name (e.g., "2019" or "2019-2020" → 2019)
              // Default to 2019 for non-year folders like "testing"
              const yearMatch = yearFolder.match(/\d{4}/);
              const folderYear = yearMatch ? parseInt(yearMatch[0]) : 2019;
              const birthYear = folderYear - age;
              dob = `${birthYear}-01-01`; // Default to Jan 1
              console.log(`    📅 Age "${rawDob}" → birth year ${birthYear}`);
            }
          }
        }

        students.push({
          studentId: data.studentId,
          name: finalName,  // Already has nickname fallback applied
          nickname: data.nickname || finalName || '',  // Use name as nickname fallback too
          nationalId: '',
          dob,
          gender,
          school: data.school || '',
          allergic: '',
          doNotEat: '',
          adContent: '',
          phone: data.mobile || '',
          sourceImage: data.sourceImage || '',
        });

        // Create parent record if we have parent name (mobile optional for Thai forms)
        if (data.parentName) {
          console.log(`    [+] Queued Parent: ${data.parentName}`);
          parents.push({
            parentId: parentId++,
            name: data.parentName,
            studentId: data.studentId,
            phone: data.mobile || '',
            sourceImage: data.sourceImage || '',
          });
        }
      } else {
        console.log(`    ℹ️  Student ${data.studentId} already exists`);
      }

      if (data.courseTitle) {
        const { courseId } = findOrCreateCourse(data.courseTitle, courses);
        console.log(`    📚 Course: ${data.courseTitle} → ${courseId}`);
        sessions.push({
          sessionId: sessionId++,
          studentId: data.studentId,
          courseId,
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
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`    ❌ Error: ${msg}`);
      failures.push({ imageName: jpgName, reason: msg });
    }
  }

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

  const sessionsWriter = createObjectCsvWriter({
    path: path.join(outputDir, 'sessions.csv'),
    encoding: 'utf8',
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

  await saveCourses(courses);
  console.log(
    `\n✅ Wrote ${students.length} students, ${parents.length} parents, ${sessions.length} sessions`,
  );
  console.log(`✅ Updated courses_master.csv (${courses.length} courses)`);

  if (failures.length > 0) {
    const failWriter = createObjectCsvWriter({
      path: failuresPath,
      encoding: 'utf8',
      header: [
        { id: 'imageName', title: 'imageName' },
        { id: 'reason', title: 'reason' },
      ],
    });
    await failWriter.writeRecords(failures);
    console.log(
      `📋 Wrote ${failures.length} failure(s) → ${path.basename(failuresPath)} (rerun with: ... ${yearFolder} --rerun-failures)`,
    );
  } else {
    if (fs.existsSync(failuresPath)) fs.unlinkSync(failuresPath);
  }
}

async function main() {
  console.log(
    '╔══════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║     Gemini Vision OCR Ingestion Script                       ║',
  );
  console.log(
    '╚══════════════════════════════════════════════════════════════╝\n',
  );
  console.log(
    `🔑 Using ${GEMINI_API_KEYS.length} Gemini API key(s)${GEMINI_API_KEYS.length > 1 ? ' (round-robin across projects)' : ''}`,
  );
  console.log(`📋 Log: ${LOG_FILE}\n`);

  const args = process.argv.slice(2);
  const target = args[0];

  if (FAILURES_FROM_OUTPUT) {
    if (!target) {
      console.log(
        '⚠️  Specify a year folder, e.g.: npx ts-node scripts/ocr-ingest-gemini-vision.ts 2019 --failures-from-output',
      );
      logFileStream.end();
      process.exit(0);
    }
    console.log(`📁 Folder: ${target} (failures-from-output only, no OCR)\n`);
    await buildFailuresFromOutput(target);
  } else if (target) {
    console.log(`📁 Folder: ${target}\n`);
    await processYearFolder(target);
  } else {
    const folders = fs
      .readdirSync(ROOT_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^\d{4}(-\d{4})?$/.test(e.name))
      .map((e) => e.name)
      .sort();
    if (!folders.length) {
      console.log('⚠️  No year folders (e.g. 2019, 2021-2020)');
      process.exit(0);
    }
    console.log(`📁 Folders: ${folders.join(', ')}\n`);
    for (const f of folders) await processYearFolder(f);
  }

  console.log(
    '\n╔══════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║     ✅ Done                                                  ║',
  );
  console.log(
    '╚══════════════════════════════════════════════════════════════╝',
  );
  console.log(`\n📂 Output: ${OUTPUT_BASE_DIR}`);
  console.log(`📋 Log: ${LOG_FILE}`);
  logFileStream.end();
}

main().catch((e) => {
  console.error('Fatal:', e);
  logFileStream.end();
  process.exit(1);
});
