/**
 * List All Rich Menus Script
 * 
 * This script lists all rich menus and shows their status
 */

import { Client } from '@line/bot-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function listRichMenus() {
  console.log('🚀 Listing all rich menus...\n');

  // Validate environment variables
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    console.error('❌ ERROR: LINE_CHANNEL_ACCESS_TOKEN not found');
    process.exit(1);
  }

  // Initialize LINE client
  const client = new Client({
    channelAccessToken,
  });

  try {
    // Get all rich menus
    const richMenus = await client.getRichMenuList();
    
    console.log(`📋 Found ${richMenus.length} rich menu(s):\n`);
    
    if (richMenus.length === 0) {
      console.log('⚠️  No rich menus found!');
      console.log('This means the menus were not created or were deleted.\n');
      return;
    }

    // Display each rich menu
    richMenus.forEach((menu, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Menu ${index + 1}:`);
      console.log(`  ID: ${menu.richMenuId}`);
      console.log(`  Name: ${menu.name}`);
      console.log(`  Chat Bar Text: ${menu.chatBarText}`);
      console.log(`  Size: ${menu.size.width}x${menu.size.height}`);
      console.log(`  Selected: ${menu.selected}`);
      console.log(`  Areas: ${menu.areas.length}`);
      
      // Check if this matches our .env IDs
      const unverifiedId = process.env.UNVERIFIED_MENU_ID;
      const verifiedId = process.env.VERIFIED_MENU_ID;
      
      if (menu.richMenuId === unverifiedId) {
        console.log(`  ✅ This is your UNVERIFIED menu (matches .env)`);
      } else if (menu.richMenuId === verifiedId) {
        console.log(`  ✅ This is your VERIFIED menu (matches .env)`);
      } else {
        console.log(`  ⚠️  This menu is NOT in your .env file`);
      }
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    });

    // Check .env IDs
    console.log('\n📝 Your .env configuration:');
    console.log(`  UNVERIFIED_MENU_ID=${process.env.UNVERIFIED_MENU_ID || 'NOT SET'}`);
    console.log(`  VERIFIED_MENU_ID=${process.env.VERIFIED_MENU_ID || 'NOT SET'}`);
    
    const unverifiedExists = richMenus.some(m => m.richMenuId === process.env.UNVERIFIED_MENU_ID);
    const verifiedExists = richMenus.some(m => m.richMenuId === process.env.VERIFIED_MENU_ID);
    
    console.log('\n🔍 Verification:');
    console.log(`  Unverified menu exists: ${unverifiedExists ? '✅ YES' : '❌ NO'}`);
    console.log(`  Verified menu exists: ${verifiedExists ? '✅ YES' : '❌ NO'}`);
    
    if (!unverifiedExists || !verifiedExists) {
      console.log('\n⚠️  WARNING: Your .env menu IDs do not match existing menus!');
      console.log('You need to either:');
      console.log('1. Update your .env with the correct menu IDs listed above');
      console.log('2. Or restart your backend to create new menus');
    }

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
  }
}

// Run the script
listRichMenus()
  .then(() => {
    console.log('\n✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
