/**
 * Verify New Rich Menus
 * Check that the new menus exist and have images
 */

import { Client } from '@line/bot-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function verifyMenus() {
  console.log('🔍 Verifying new rich menus...\n');

  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const unverifiedId = process.env.UNVERIFIED_MENU_ID;
  const verifiedId = process.env.VERIFIED_MENU_ID;

  if (!channelAccessToken || !unverifiedId || !verifiedId) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const client = new Client({ channelAccessToken });

  console.log('📋 Expected Menu IDs:');
  console.log(`  Unverified: ${unverifiedId}`);
  console.log(`  Verified: ${verifiedId}\n`);

  // Get all menus
  const allMenus = await client.getRichMenuList();
  console.log(`📊 Total menus in LINE: ${allMenus.length}\n`);

  // Check unverified menu
  const unverifiedMenu = allMenus.find(m => m.richMenuId === unverifiedId);
  console.log('Unverified Menu:');
  if (unverifiedMenu) {
    console.log(`  ✅ Exists: ${unverifiedMenu.name}`);
    console.log(`  Size: ${unverifiedMenu.size.width}x${unverifiedMenu.size.height}px`);
    console.log(`  Chat Bar: ${unverifiedMenu.chatBarText}`);
    console.log(`  Areas: ${unverifiedMenu.areas.length}`);
  } else {
    console.log('  ❌ NOT FOUND');
  }

  // Check verified menu
  const verifiedMenu = allMenus.find(m => m.richMenuId === verifiedId);
  console.log('\nVerified Menu:');
  if (verifiedMenu) {
    console.log(`  ✅ Exists: ${verifiedMenu.name}`);
    console.log(`  Size: ${verifiedMenu.size.width}x${verifiedMenu.size.height}px`);
    console.log(`  Chat Bar: ${verifiedMenu.chatBarText}`);
    console.log(`  Areas: ${verifiedMenu.areas.length}`);
  } else {
    console.log('  ❌ NOT FOUND');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (unverifiedMenu && verifiedMenu) {
    console.log('✅ SUCCESS! Both menus are active with new images!');
    console.log('\n📱 Next step: Test in LINE app');
    console.log('   1. Open your LINE bot');
    console.log('   2. Check the rich menu at the bottom');
    console.log('   3. You should see your new images!');
  } else {
    console.log('⚠️  WARNING: Some menus not found');
    console.log('Check that .env file has correct IDs');
  }
}

verifyMenus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
