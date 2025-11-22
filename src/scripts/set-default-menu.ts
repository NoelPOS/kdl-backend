/**
 * Set Default Rich Menu
 * Make the unverified menu the default so all users see it
 */

import { Client } from '@line/bot-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function setDefaultMenu() {
  console.log('🔧 Setting default rich menu...\n');

  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const unverifiedMenuId = process.env.UNVERIFIED_MENU_ID;

  if (!channelAccessToken || !unverifiedMenuId) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const client = new Client({ channelAccessToken });

  try {
    // Check current default
    console.log('📋 Checking current default menu...');
    try {
      const currentDefault = await client.getDefaultRichMenuId();
      console.log(`Current default: ${currentDefault}\n`);
    } catch (e) {
      console.log('No default menu set\n');
    }

    // Set unverified menu as default
    console.log(`Setting unverified menu as default: ${unverifiedMenuId}`);
    await client.setDefaultRichMenu(unverifiedMenuId);
    console.log('✅ Default menu set!\n');

    // Verify
    const newDefault = await client.getDefaultRichMenuId();
    console.log(`✅ Verified - New default: ${newDefault}`);
    
    console.log('\n🎉 Success! The unverified menu is now the default.');
    console.log('📱 Try opening your LINE bot now - you should see the menu!');

  } catch (error: any) {
    console.error('❌ Failed to set default menu');
    console.error(`Error: ${error.message}`);
    
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

setDefaultMenu()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
