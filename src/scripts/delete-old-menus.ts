/**
 * Delete Existing Rich Menus
 * Step 1: Delete the current menus so we can create fresh ones
 */

import { Client } from '@line/bot-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function deleteExistingMenus() {
  console.log('🗑️  Deleting existing rich menus...\n');

  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    console.error('❌ LINE_CHANNEL_ACCESS_TOKEN not found');
    process.exit(1);
  }

  const client = new Client({ channelAccessToken });

  const menuIdsToDelete = [
    process.env.UNVERIFIED_MENU_ID,
    process.env.VERIFIED_MENU_ID
  ].filter(Boolean);

  console.log(`Found ${menuIdsToDelete.length} menus to delete:\n`);

  for (const menuId of menuIdsToDelete) {
    try {
      console.log(`Deleting: ${menuId}`);
      await client.deleteRichMenu(menuId!);
      console.log(`✅ Deleted successfully\n`);
    } catch (error: any) {
      console.error(`❌ Failed to delete ${menuId}`);
      console.error(`   Error: ${error.message}\n`);
    }
  }

  console.log('🎉 Deletion complete!');
  console.log('\nNext step: Create new menus with your new images');
}

deleteExistingMenus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
