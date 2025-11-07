/**
 * Check Rich Menu Image Dimensions
 * Verifies that your images are exactly 2500x843px as required by LINE
 */

import * as fs from 'fs';
import * as path from 'path';

const IMAGE_DIR = path.join(__dirname, '../../public/rich-menu-images');

const images = [
  'unverified-menu.png',
  'verified-menu.png',
];

console.log('🔍 Checking image dimensions...\n');
console.log(`Directory: ${IMAGE_DIR}\n`);

images.forEach(imageName => {
  const imagePath = path.join(IMAGE_DIR, imageName);
  
  if (!fs.existsSync(imagePath)) {
    console.log(`❌ ${imageName}: File not found`);
    return;
  }

  const buffer = fs.readFileSync(imagePath);
  const dimensions = getImageDimensions(buffer);
  
  console.log(`📸 ${imageName}:`);
  console.log(`   Width: ${dimensions.width}px`);
  console.log(`   Height: ${dimensions.height}px`);
  console.log(`   File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  
  if (dimensions.width === 2500 && dimensions.height === 843) {
    console.log(`   ✅ Dimensions are correct!`);
  } else {
    console.log(`   ❌ WRONG DIMENSIONS! Must be exactly 2500x843px`);
    console.log(`   Action needed: Resize image to 2500x843px`);
  }
  console.log('');
});

function getImageDimensions(buffer: Buffer): { width: number; height: number } {
  // PNG signature check
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    // PNG format
    // Width is at bytes 16-19, height at 20-23 (big-endian)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }
  
  // JPEG signature check
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    // JPEG format - need to find SOF marker
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xFF) break;
      
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      
      // SOF0, SOF1, SOF2 markers contain dimensions
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      
      offset += length + 2;
    }
  }
  
  return { width: 0, height: 0 };
}

console.log('📋 Summary:');
console.log('Required dimensions: 2500 x 843 pixels');
console.log('Recommended file size: Under 1 MB');
console.log('\nIf dimensions are wrong, please resize your images using:');
console.log('- Photoshop, GIMP, or Paint.NET (desktop)');
console.log('- Canva or Figma (online)');
console.log('- ImageMagick: convert input.png -resize 2500x843! output.png');
