import * as fs from 'fs';
import * as path from 'path';

// Simple PNG dimension checker
function getPNGDimensions(filePath: string): { width: number; height: number } | null {
  try {
    const buffer = fs.readFileSync(filePath);
    
    // PNG signature check
    if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
      console.log('Not a valid PNG file');
      return null;
    }
    
    // Read IHDR chunk (starts at byte 16)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    
    return { width, height };
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
}

const imageDir = path.join(__dirname, '../../public/rich-menu-images');

console.log('🔍 Checking rich menu image dimensions...\n');

// Check unverified menu
const unverifiedPath = path.join(imageDir, 'unverified-menu.png');
console.log('Unverified Menu:');
console.log(`  Path: ${unverifiedPath}`);
const unverifiedDims = getPNGDimensions(unverifiedPath);
if (unverifiedDims) {
  console.log(`  Dimensions: ${unverifiedDims.width}x${unverifiedDims.height}px`);
  console.log(`  Required: 2500x843px`);
  console.log(`  Status: ${unverifiedDims.width === 2500 && unverifiedDims.height === 843 ? '✅ CORRECT' : '❌ INCORRECT'}\n`);
} else {
  console.log('  ❌ Could not read dimensions\n');
}

// Check verified menu
const verifiedPath = path.join(imageDir, 'verified-menu.png');
console.log('Verified Menu:');
console.log(`  Path: ${verifiedPath}`);
const verifiedDims = getPNGDimensions(verifiedPath);
if (verifiedDims) {
  console.log(`  Dimensions: ${verifiedDims.width}x${verifiedDims.height}px`);
  console.log(`  Required: 2500x843px`);
  console.log(`  Status: ${verifiedDims.width === 2500 && verifiedDims.height === 843 ? '✅ CORRECT' : '❌ INCORRECT'}\n`);
} else {
  console.log('  ❌ Could not read dimensions\n');
}
