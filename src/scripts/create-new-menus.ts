/**
 * Create New Rich Menus and Upload Images
 * Step 2: Create fresh menus and immediately upload the new images
 */

import { Client } from '@line/bot-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function createAndUploadMenus() {
  console.log('🚀 Creating new rich menus with images...\n');

  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const liffId = process.env.LINE_LIFF_ID;
  
  if (!channelAccessToken || !liffId) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  const client = new Client({ channelAccessToken });
  const imageDir = path.join(__dirname, '../../public/rich-menu-images');

  // Create Unverified Menu
  console.log('📋 Creating Unverified Menu...');
  const unverifiedMenu = await client.createRichMenu({
    size: { width: 2500, height: 843 },
    selected: true,
    name: 'Unverified Parent Menu',
    chatBarText: 'Please Login',
    areas: [{
      bounds: { x: 0, y: 0, width: 2500, height: 843 },
      action: {
        type: 'uri',
        label: 'Login',
        uri: `https://liff.line.me/${liffId}/verify`
      }
    }]
  });
  console.log(`✅ Created: ${unverifiedMenu}`);

  // Upload Unverified Image
  console.log('📤 Uploading unverified menu image...');
  const unverifiedImage = fs.readFileSync(path.join(imageDir, 'unverified-menu.jpg'));
  await client.setRichMenuImage(unverifiedMenu, unverifiedImage, 'image/jpeg');
  console.log('✅ Image uploaded\n');

  // Create Verified Menu
  console.log('📋 Creating Verified Menu...');
  const verifiedMenu = await client.createRichMenu({
    size: { width: 2500, height: 843 },
    selected: true,
    name: 'Verified Parent Menu',
    chatBarText: 'KDL Portal',
    areas: [{
      bounds: { x: 0, y: 0, width: 2500, height: 843 },
      action: {
        type: 'uri',
        label: 'My Portal',
        uri: `https://liff.line.me/${liffId}/children`
      }
    }]
  });
  console.log(`✅ Created: ${verifiedMenu}`);

  // Upload Verified Image
  console.log('📤 Uploading verified menu image...');
  const verifiedImage = fs.readFileSync(path.join(imageDir, 'verified-menu.jpg'));
  await client.setRichMenuImage(verifiedMenu, verifiedImage, 'image/jpeg');
  console.log('✅ Image uploaded\n');

  // Display results
  console.log('🎉 All menus created and images uploaded!\n');
  console.log('📝 New Menu IDs:');
  console.log(`UNVERIFIED_MENU_ID=${unverifiedMenu}`);
  console.log(`VERIFIED_MENU_ID=${verifiedMenu}`);
  console.log('\n⚠️  IMPORTANT: Update these IDs in:');
  console.log('  1. Local .env');
  console.log('  2. EC2 ~/kdl-app/backend.env');
  console.log('  3. Restart backend container on EC2');

  return { unverifiedMenu, verifiedMenu };
}

createAndUploadMenus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
