/**
 * Debug OCR Script
 * 
 * Shows raw OCR text output for specific images to help debug extraction issues
 * 
 * Usage:
 *   npx ts-node scripts/debug-ocr.ts 2019 IMG_7630.HEIC
 *   npx ts-node scripts/debug-ocr.ts 2019 IMG_7636.HEIC
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as util from 'util';

const ROOT_DIR = path.join(__dirname, '../..');
const PYTHON_EXE = process.env.PYTHON_EXE || 'python';
const PYTHON_WORKER = path.join(__dirname, '../ocr-service/worker.py');

async function runOCR(imagePath: string, isExhaustive: boolean = false): Promise<string> {
    return new Promise((resolve, reject) => {
        const process = spawn(PYTHON_EXE, [PYTHON_WORKER], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        process.stdout.on('data', (data: Buffer) => {
            output += data.toString();
        });

        process.stderr.on('data', (data: Buffer) => {
            errorOutput += data.toString();
        });

        process.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python process exited with code ${code}: ${errorOutput}`));
                return;
            }
            resolve(output.trim());
        });

        // Send image path to worker
        const input = imagePath + (isExhaustive ? ' --exhaustive' : '') + '\n';
        process.stdin.write(input);
        process.stdin.end();
    });
}

async function debugImage(yearFolder: string, imageFile: string) {
    const imagePath = path.join(ROOT_DIR, yearFolder, imageFile);
    const jpgCachePath = path.join(ROOT_DIR, yearFolder, 'jpg-cache', imageFile.replace(/\.heic$/i, '.jpg'));

    if (!fs.existsSync(imagePath) && !fs.existsSync(jpgCachePath)) {
        console.error(`❌ Image not found: ${imagePath}`);
        return;
    }

    const targetPath = fs.existsSync(jpgCachePath) ? jpgCachePath : imagePath;
    console.log(`\n🔍 Debugging OCR for: ${imageFile}`);
    console.log(`📁 Using image: ${targetPath}`);
    console.log('='.repeat(60));

    try {
        const jsonResult = await runOCR(targetPath, true); // Use exhaustive mode
        const parsedResult = JSON.parse(jsonResult);

        if (parsedResult.error) {
            console.error(`❌ OCR Error: ${parsedResult.error}`);
            return;
        }

        console.log('\n📝 Raw OCR Text Output:');
        console.log('-'.repeat(60));
        
        const rawText = parsedResult.map((item: any) => item.text).join('\n');
        console.log(rawText);
        
        console.log('\n📊 OCR Results with Confidence:');
        console.log('-'.repeat(60));
        parsedResult.forEach((item: any, index: number) => {
            console.log(`[${index + 1}] (${(item.confidence * 100).toFixed(1)}%) ${item.text}`);
        });

        console.log('\n🔍 Extraction Attempts:');
        console.log('-'.repeat(60));
        
        // Try to extract Student ID
        const idMatch = rawText.match(/Student ID\s*[:\.]?\s*([0-9oO\s]{4,})/i);
        if (idMatch) {
            console.log(`✅ Student ID found: ${idMatch[1].replace(/[oO]/g, '0').replace(/\s/g, '')}`);
        } else {
            const potentialIds = rawText.match(/\b(20\d{7,})\b/g);
            if (potentialIds) {
                console.log(`⚠️  Student ID (pattern search): ${potentialIds[0]}`);
            } else {
                console.log(`❌ Student ID: NOT FOUND`);
            }
        }

        // Try to extract Student Name
        let nameMatch = rawText.match(/Student Name[:\s]+(.*?)(?=\s+(?:Nickname|Date|School|Sex[:\s]|Parent|Mobile|Teacher|Course|$))/i);
        if (nameMatch) {
            console.log(`✅ Student Name (Strategy 1): "${nameMatch[1].trim()}"`);
        } else {
            nameMatch = rawText.match(/Student Name[:\s]+([^\n\r]{1,100})/i);
            if (nameMatch) {
                console.log(`⚠️  Student Name (Strategy 2): "${nameMatch[1].trim()}"`);
            } else {
                const lines = rawText.split('\n');
                const nameLabelIndex = lines.findIndex(line => /Student Name[:\s]*/i.test(line));
                if (nameLabelIndex >= 0 && nameLabelIndex < lines.length - 1) {
                    console.log(`⚠️  Student Name (Strategy 3 - next line): "${lines[nameLabelIndex + 1]?.trim()}"`);
                } else {
                    console.log(`❌ Student Name: NOT FOUND`);
                }
            }
        }

        console.log('\n' + '='.repeat(60));

    } catch (err: any) {
        console.error(`❌ Error: ${err.message}`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: npx ts-node scripts/debug-ocr.ts <year-folder> <image-file>');
        console.log('Example: npx ts-node scripts/debug-ocr.ts 2019 IMG_7630.HEIC');
        process.exit(1);
    }

    const yearFolder = args[0];
    const imageFile = args[1];

    await debugImage(yearFolder, imageFile);
}

main().catch(console.error);
