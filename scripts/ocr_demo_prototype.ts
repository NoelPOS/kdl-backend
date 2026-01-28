import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import * as fs from 'fs';
import * as path from 'path';
// We will use 'sharp' for HEIC conversion. 
// Note: You need to install it: npm install sharp
import * as sharp from 'sharp';

// 1. Initialize AWS Textract
const client = new TextractClient({ 
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

async function processImage(filePath: string) {
    console.log(`Processing: ${filePath}`);
    
    // 2. Handle HEIC Images (iPhone)
    // AWS Textract ONLY supports JPG, PNG, PDF. It does NOT support HEIC.
    let imageBytes: Buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.heic') {
        console.log('Detected HEIC format. Converting to JPEG...');
        imageBytes = await sharp(imageBytes)
            .toFormat('jpeg')
            .toBuffer();
    }

    // 3. Send to AWS Textract
    const command = new DetectDocumentTextCommand({
        Document: { Bytes: imageBytes }
    });

    try {
        const response = await client.send(command);
        
        // 4. Extract specific information using Regex
        // This simulates reading a form
        const rawText = response.Blocks
            .filter(block => block.BlockType === 'LINE')
            .map(block => block.Text)
            .join('\n');

        console.log('--- Raw OCR Output ---');
        console.log(rawText);
        console.log('----------------------');

        const extractedData = extractInformation(rawText);
        console.log('Extracted Data:', extractedData);

        return extractedData;

    } catch (error) {
        console.error("Error processing image:", error);
    }
}

// 5. Example Extraction Logic
function extractInformation(text: string) {
    const data = {
        studentName: '',
        nickname: '',
        parentName: '',
        phoneNumber: ''
    };

    // Example Patterns (We can tune these based on your actual form design)
    const namePattern = /(?:Name|Student Name)[:\s]+([A-Za-z\s]+)/i;
    const nicknamePattern = /(?:Nickname)[:\s]+([A-Za-z]+)/i;
    const phonePattern = /(?:Phone|Mobile|Tel)[:\s]+(\d{2,3}[-\s]?\d{3}[-\s]?\d{4})/i;

    // Match patterns
    const nameMatch = text.match(namePattern);
    if (nameMatch) data.studentName = nameMatch[1].trim();

    const nickMatch = text.match(nicknamePattern);
    if (nickMatch) data.nickname = nickMatch[1].trim();

    const phoneMatch = text.match(phonePattern);
    if (phoneMatch) data.phoneNumber = phoneMatch[1].replace(/[-\s]/g, '');

    return data;
}

// Example Usage
// processImage('./uploads/test-iphone-photo.heic');
