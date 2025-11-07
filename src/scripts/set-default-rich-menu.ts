/**
 * Set Default Rich Menu Script
 * 
 * Sets the unverified menu as the default for all new users who add the bot
 */

import { Client } from '@line/bot-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function setDefaultRichMenu() {
  console.log('🎯 Setting Default Rich Menu...\n');

  // Validate environment variables
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const unverifiedMenuId = process.env.UNVERIFIED_MENU_ID;

  if (!channelAccessToken) {
    console.error('❌ ERROR: LINE_CHANNEL_ACCESS_TOKEN not found');
    process.exit(1);
  }

  if (!unverifiedMenuId) {
    console.error('❌ ERROR: UNVERIFIED_MENU_ID not found in .env');
    process.exit(1);
  }

  // Initialize LINE client
  const client = new Client({ channelAccessToken });

  try {
    // Set default rich menu
    console.log(`📋 Setting default rich menu to: ${unverifiedMenuId}\n`);
    await client.setDefaultRichMenu(unverifiedMenuId);
    
    console.log('✅ Default rich menu set successfully!');
    console.log('\n📌 What this means:');
    console.log('   - All new users who add your bot will see the unverified menu');
    console.log('   - Existing users need to block/unblock or have the menu assigned manually');
    console.log('\n💡 To apply to YOUR account right now:');
    console.log('   1. Block your bot in LINE');
    console.log('   2. Unblock/Re-add your bot');
    console.log('   3. The unverified menu should appear!\n');

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    if (error.message.includes('404')) {
      console.error('\n💡 This menu ID does not exist or has no image uploaded');
      console.error('   Run: npm run upload-rich-menu-images');
    }
    process.exit(1);
  }
}

// Run the script
setDefaultRichMenu()
  .then(() => {
    console.log('✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
