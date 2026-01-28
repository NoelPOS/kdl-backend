/**
 * Analyze Unclean Data Script
 * 
 * Analyzes students.csv and identifies unclean/bad data entries
 * 
 * Usage:
 *   npx ts-node scripts/analyze-unclean-data.ts 2019
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const ROOT_DIR = path.join(__dirname, '../..');
const OCR_OUTPUT_DIR = path.join(ROOT_DIR, 'ocr-output');

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
    
    // Very short random letter combinations
    if (name.length <= 4) {
        const vowels = (name.match(/[aeiouAEIOU]/g) || []).length;
        const consonants = name.replace(/[^a-zA-Z]/g, '').length - vowels;
        if (vowels === 0 || (consonants > vowels * 2 && name.length <= 4)) {
            const commonShortNames = ['ali', 'amy', 'ian', 'max', 'leo', 'jay', 'kim', 'ray', 'roy', 'tom', 'tim', 'sam', 'dan', 'ben', 'joe', 'ted', 'hal', 'pat', 'lee', 'kai', 'rio', 'noa', 'eva', 'ava', 'mia', 'zoe', 'liz', 'ann', 'may', 'joy', 'sue', 'meg', 'pam', 'jan', 'jim', 'bob', 'rob', 'don', 'ron', 'ken', 'len', 'ned', 'rex', 'tad', 'van', 'wes', 'zac'];
            if (!commonShortNames.includes(lower)) {
                return true;
            }
        }
    }
    
    return false;
}

function analyzeYear(yearFolder: string) {
    const studentsFile = path.join(OCR_OUTPUT_DIR, yearFolder, 'students.csv');
    
    if (!fs.existsSync(studentsFile)) {
        console.error(`❌ students.csv not found for ${yearFolder}`);
        return;
    }

    const content = fs.readFileSync(studentsFile, 'utf-8');
    const students: any[] = parse(content, { columns: true, skip_empty_lines: true });

    console.log(`\n📊 Analyzing ${yearFolder} students.csv`);
    console.log('='.repeat(60));

    const issues: Array<{
        studentId: string;
        name: string;
        issue: string;
        sourceImage: string;
    }> = [];

    // Categories
    const emptyNames: any[] = [];
    const badNames: any[] = [];
    const suspiciousNames: any[] = [];

    for (const student of students) {
        const name = (student.name || '').toString();
        const studentId = (student.studentId || '').toString();

        // Empty names
        if (!name || name.trim().length === 0) {
            emptyNames.push(student);
            issues.push({
                studentId,
                name: '(empty)',
                issue: 'Empty name',
                sourceImage: (student.sourceImage || 'unknown').toString()
            });
            continue;
        }

        // Bad names (Thai-word-caused OCR errors)
        if (isBadName(name)) {
            badNames.push(student);
            let issueType = 'Bad name (likely Thai-word-caused OCR error)';
            
            // Specific pattern detection
            if (/^\.\w+\.\w+$/.test(name) || /^\.\w+$/.test(name)) {
                issueType = 'Bad name: Dots with letters (e.g., .y.s)';
            } else if (/^[a-z]+\d{2,}$/i.test(name) || /^[a-z]\d+$/i.test(name)) {
                issueType = 'Bad name: Numbers mixed with letters (e.g., n5455)';
            } else if (name.length <= 4 && (name.match(/[aeiouAEIOU]/g) || []).length < 2) {
                issueType = 'Bad name: Random letter combinations (e.g., nsasa, wlna)';
            } else if (/^(Male|Female|male|female)$/i.test(name)) {
                issueType = 'Bad name: Sex value extracted as name';
            }

            issues.push({
                studentId,
                name,
                issue: issueType,
                sourceImage: (student.sourceImage || 'unknown').toString()
            });
            continue;
        }

        // Suspicious but might be valid (very short names, unusual patterns)
        if (name.length <= 4 || /^[a-z]{2,4}$/i.test(name)) {
            suspiciousNames.push(student);
        }
    }

    // Summary
    console.log(`\n📈 Summary:`);
    console.log(`   Total students: ${students.length}`);
    console.log(`   ✅ Clean names: ${students.length - issues.length}`);
    console.log(`   ❌ Issues found: ${issues.length}`);
    console.log(`      - Empty names: ${emptyNames.length}`);
    console.log(`      - Bad names: ${badNames.length}`);
    console.log(`      - Suspicious names: ${suspiciousNames.length}`);

    // Detailed issues
    if (issues.length > 0) {
        console.log(`\n❌ Unclean Data Details:`);
        console.log('='.repeat(60));
        
        issues.forEach((issue, index) => {
            console.log(`\n[${index + 1}] ${issue.studentId}`);
            console.log(`   Name: "${issue.name}"`);
            console.log(`   Issue: ${issue.issue}`);
            console.log(`   Image: ${issue.sourceImage}`);
        });
    }

    // Export to CSV
    if (issues.length > 0) {
        const issuesFile = path.join(OCR_OUTPUT_DIR, yearFolder, 'unclean-data-analysis.csv');
        const csvContent = [
            'studentId,name,issue,sourceImage',
            ...issues.map(i => `"${i.studentId}","${i.name}","${i.issue}","${i.sourceImage}"`)
        ].join('\n');
        
        fs.writeFileSync(issuesFile, csvContent);
        console.log(`\n💾 Exported analysis to: ${issuesFile}`);
    }

    return {
        total: students.length,
        clean: students.length - issues.length,
        issues: issues.length,
        emptyNames: emptyNames.length,
        badNames: badNames.length,
        suspiciousNames: suspiciousNames.length
    };
}

async function main() {
    const args = process.argv.slice(2);
    const yearFolder = args[0] || '2019';

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║          Unclean Data Analysis Script                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    analyzeYear(yearFolder);
}

main().catch(console.error);
