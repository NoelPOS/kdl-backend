/**
 * Cleanup Rich Menus Script
 * 
 * Deletes all rich menus EXCEPT the ones specified in .env
 */

import { Client } from '@line/bot-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function cleanupRichMenus() {
  console.log('🧹 Rich Menu Cleanup Script\n');

  // Validate environment variables
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const keepUnverified = process.env.UNVERIFIED_MENU_ID;
  const keepVerified = process.env.VERIFIED_MENU_ID;

  if (!channelAccessToken) {
    console.error('❌ ERROR: LINE_CHANNEL_ACCESS_TOKEN not found');
    process.exit(1);
  }

  if (!keepUnverified || !keepVerified) {
    console.error('❌ ERROR: UNVERIFIED_MENU_ID or VERIFIED_MENU_ID not found in .env');
    process.exit(1);
  }

  // Initialize LINE client
  const client = new Client({ channelAccessToken });

  try {
    // Get all rich menus
    const richMenus = await client.getRichMenuList();
    
    console.log(`📋 Found ${richMenus.length} total rich menus\n`);
    
    // Filter menus to keep vs delete
    const menusToKeep = richMenus.filter(m => 
      m.richMenuId === keepUnverified || m.richMenuId === keepVerified
    );
    
    const menusToDelete = richMenus.filter(m => 
      m.richMenuId !== keepUnverified && m.richMenuId !== keepVerified
    );

    console.log(`✅ Keeping ${menusToKeep.length} menus:`);
    menusToKeep.forEach(m => {
      console.log(`   - ${m.name} (${m.richMenuId})`);
    });

    console.log(`\n🗑️  Will delete ${menusToDelete.length} menus\n`);

    if (menusToDelete.length === 0) {
      console.log('✨ No menus to delete!');
      rl.close();
      return;
    }

    // Ask for confirmation
    const answer = await askQuestion(`⚠️  Are you sure you want to delete ${menusToDelete.length} menus? (yes/no): `);
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Cancelled - no menus were deleted');
      rl.close();
      return;
    }

    // Delete menus
    console.log(`\n🔄 Deleting ${menusToDelete.length} menus...\n`);
    let deleted = 0;
    let failed = 0;

    for (const menu of menusToDelete) {
      try {
        await client.deleteRichMenu(menu.richMenuId);
        deleted++;
        process.stdout.write(`\r✅ Deleted: ${deleted}/${menusToDelete.length}`);
      } catch (error: any) {
        failed++;
        console.log(`\n⚠️  Failed to delete ${menu.richMenuId}: ${error.message}`);
      }
    }

    console.log(`\n\n🎉 Cleanup complete!`);
    console.log(`   Deleted: ${deleted}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Remaining: ${menusToKeep.length}\n`);

    rl.close();

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    rl.close();
    process.exit(1);
  }
}

// Run the script
cleanupRichMenus();
