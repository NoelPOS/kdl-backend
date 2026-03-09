/**
 * Check User's Current Rich Menu
 * See what menu is assigned to your LINE user ID
 */

import { Client } from '@line/bot-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function checkUserMenu() {
  console.log("🔍 Checking user's rich menu assignment...\n");

  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const expectedUnverified = process.env.UNVERIFIED_MENU_ID;
  const expectedVerified = process.env.VERIFIED_MENU_ID;

  if (!channelAccessToken) {
    console.error('❌ LINE_CHANNEL_ACCESS_TOKEN not found');
    process.exit(1);
  }

  const client = new Client({ channelAccessToken });

  // Ask for user ID
  const userId = await askQuestion(
    'Enter your LINE User ID (from database or previous logs): ',
  );
  console.log();

  try {
    // Get user's assigned menu
    console.log(`📋 Checking menu for user: ${userId}\n`);

    try {
      const assignedMenuId = await client.getRichMenuIdOfUser(userId);
      console.log(`Current assigned menu: ${assignedMenuId}\n`);

      // Check which menu it is
      if (assignedMenuId === expectedUnverified) {
        console.log(
          '📌 User has: UNVERIFIED menu (correct for unverified users)',
        );
      } else if (assignedMenuId === expectedVerified) {
        console.log('✅ User has: VERIFIED menu (correct for verified users)');
      } else {
        console.log('⚠️  User has: UNKNOWN menu (probably old/deleted menu)');
        console.log('   This is why you see the default menu instead!');
      }

      console.log('\n🔧 Expected Menu IDs:');
      console.log(`   Unverified: ${expectedUnverified}`);
      console.log(`   Verified: ${expectedVerified}`);

      if (assignedMenuId !== expectedVerified) {
        console.log(
          '\n💡 Solution: Manually assign verified menu to this user',
        );
        const assign = await askQuestion(
          '\nWould you like to assign the verified menu now? (yes/no): ',
        );

        if (assign.toLowerCase() === 'yes') {
          console.log('\n🔄 Assigning verified menu...');
          await client.linkRichMenuToUser(userId, expectedVerified!);
          console.log('✅ Verified menu assigned!');
          console.log('📱 Close and reopen your LINE bot to see the change!');
        }
      }
    } catch (error: any) {
      if (error.message.includes('404')) {
        console.log('ℹ️  No menu assigned to this user');
        console.log('   User is seeing the default menu (unverified)\n');

        const assign = await askQuestion(
          'Would you like to assign the verified menu? (yes/no): ',
        );
        if (assign.toLowerCase() === 'yes') {
          console.log('\n🔄 Assigning verified menu...');
          await client.linkRichMenuToUser(userId, expectedVerified!);
          console.log('✅ Verified menu assigned!');
          console.log('📱 Close and reopen your LINE bot to see the change!');
        }
      } else {
        throw error;
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

checkUserMenu();
