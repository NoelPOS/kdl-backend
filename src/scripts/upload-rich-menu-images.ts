/**
 * Rich Menu Image Upload Script
 * 
 * This script uploads images to existing LINE rich menus.
 * 
 * Usage:
 * 1. Place your images in the specified directory
 * 2. Update the IMAGE_PATHS below with your image file names
 * 3. Set your environment variables (LINE_CHANNEL_ACCESS_TOKEN)
 * 4. Run: node dist/scripts/upload-rich-menu-images.js
 * 
 * Required:
 * - Unverified menu image: 2500x843px (PNG or JPG)
 * - Verified menu image: 2500x843px (PNG or JPG)
 */

import { Client } from '@line/bot-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ===== CONFIGURATION - UPDATE THESE VALUES =====

// Directory where your rich menu images are stored
const IMAGE_DIR = path.join(__dirname, '../../public/rich-menu-images');

// Image file names (must be 2500x843px, PNG or JPG)
const IMAGE_PATHS = {
  unverified: 'unverified-menu.png', // Image for unverified parents
  verified: 'verified-menu.png',     // Image for verified parents
};

// Rich menu IDs (get these from LINE Developers Console or your logs)
const MENU_IDS = {
  unverified: process.env.UNVERIFIED_MENU_ID || 'richmenu-XXXXXXXX', // Replace with actual ID
  verified: process.env.VERIFIED_MENU_ID || 'richmenu-YYYYYYYY',     // Replace with actual ID
};

// ===== END CONFIGURATION =====

async function uploadRichMenuImages() {
  console.log('🚀 Starting rich menu image upload script...\n');

  // Validate environment variables
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    console.error('❌ ERROR: LINE_CHANNEL_ACCESS_TOKEN not found in environment variables');
    console.error('Please set it in your .env file or environment');
    process.exit(1);
  }

  // Initialize LINE client
  const client = new Client({
    channelAccessToken,
  });

  console.log('✅ LINE client initialized');
  console.log(`📁 Image directory: ${IMAGE_DIR}\n`);

  // Check if image directory exists
  if (!fs.existsSync(IMAGE_DIR)) {
    console.log(`📂 Creating image directory: ${IMAGE_DIR}`);
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
    console.log('\n⚠️  Please add your images to this directory:');
    console.log(`   - ${IMAGE_PATHS.unverified} (2500x843px)`);
    console.log(`   - ${IMAGE_PATHS.verified} (2500x843px)`);
    console.log('\nThen run this script again.');
    process.exit(0);
  }

  // Upload unverified menu image
  await uploadImage(
    client,
    MENU_IDS.unverified,
    path.join(IMAGE_DIR, IMAGE_PATHS.unverified),
    'Unverified Menu'
  );

  // Upload verified menu image
  await uploadImage(
    client,
    MENU_IDS.verified,
    path.join(IMAGE_DIR, IMAGE_PATHS.verified),
    'Verified Menu'
  );

  console.log('\n🎉 All images uploaded successfully!');
  console.log('\nNext steps:');
  console.log('1. Verify a parent account');
  console.log('2. The rich menu should change from unverified to verified');
}

async function uploadImage(
  client: Client,
  menuId: string,
  imagePath: string,
  menuName: string
): Promise<void> {
  console.log(`\n📤 Uploading ${menuName}...`);
  console.log(`   Menu ID: ${menuId}`);
  console.log(`   Image: ${imagePath}`);

  // Check if image file exists
  if (!fs.existsSync(imagePath)) {
    console.error(`   ❌ ERROR: Image file not found: ${imagePath}`);
    console.error(`   Please create this image (2500x843px) and try again`);
    return;
  }

  // Check file size and dimensions (basic validation)
  const stats = fs.statSync(imagePath);
  const fileSizeMB = stats.size / (1024 * 1024);
  console.log(`   File size: ${fileSizeMB.toFixed(2)} MB`);

  if (fileSizeMB > 1) {
    console.warn(`   ⚠️  WARNING: File size is large (${fileSizeMB.toFixed(2)} MB)`);
    console.warn(`   LINE recommends images under 1MB for faster loading`);
  }

  // Determine content type from file extension
  const ext = path.extname(imagePath).toLowerCase();
  let contentType: string;
  if (ext === '.png') {
    contentType = 'image/png';
  } else if (ext === '.jpg' || ext === '.jpeg') {
    contentType = 'image/jpeg';
  } else {
    console.error(`   ❌ ERROR: Unsupported file type: ${ext}`);
    console.error(`   Please use PNG or JPEG format`);
    return;
  }

  try {
    // Read image file
    const imageBuffer = fs.readFileSync(imagePath);
    console.log(`   Content type: ${contentType}`);

    // Upload to LINE
    console.log(`   🔄 Uploading to LINE...`);
    await client.setRichMenuImage(menuId, imageBuffer, contentType);

    console.log(`   ✅ ${menuName} image uploaded successfully!`);
  } catch (error: any) {
    console.error(`   ❌ ERROR: Failed to upload image`);
    console.error(`   Message: ${error.message}`);
    
    if (error.message.includes('400')) {
      console.error(`   Possible causes:`);
      console.error(`   - Image dimensions not exactly 2500x843px`);
      console.error(`   - Invalid image format`);
      console.error(`   - Corrupted image file`);
    } else if (error.message.includes('404')) {
      console.error(`   Possible causes:`);
      console.error(`   - Rich menu ID not found: ${menuId}`);
      console.error(`   - Menu may have been deleted`);
    } else if (error.message.includes('401')) {
      console.error(`   Possible causes:`);
      console.error(`   - Invalid LINE_CHANNEL_ACCESS_TOKEN`);
      console.error(`   - Token may have expired`);
    }
  }
}

// Run the script
uploadRichMenuImages()
  .then(() => {
    console.log('\n✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
