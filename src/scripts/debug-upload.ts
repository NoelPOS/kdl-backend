import { Client } from '@line/bot-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function debugUpload() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const menuId = process.env.UNVERIFIED_MENU_ID!;
  const imagePath = path.join(__dirname, '../../public/rich-menu-images/unverified-menu.jpg');
  
  console.log('🔍 Debug Upload with Full Error Details\n');
  console.log(`Channel Token: ${channelAccessToken?.substring(0, 20)}...`);
  console.log(`Menu ID: ${menuId}`);
  console.log(`Image: ${imagePath}\n`);
  
  const imageBuffer = fs.readFileSync(imagePath);
  const stats = fs.statSync(imagePath);
  
  console.log(`File size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
  console.log(`Content-Type: image/jpeg\n`);
  
  try {
    // Manual API call with detailed error logging
    const url = `https://api-data.line.me/v2/bot/richmenu/${menuId}/content`;
    
    console.log(`Making POST request to: ${url}\n`);
    
    const response = await axios.post(url, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`,
        'Content-Type': 'image/jpeg',
        'Content-Length': imageBuffer.length
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    
    console.log('✅ Upload successful!');
    console.log('Response:', response.data);
    
  } catch (error: any) {
    console.error('❌ Upload failed\n');
    console.error('Error details:');
    console.error(`  Message: ${error.message}`);
    console.error(`  Status: ${error.response?.status}`);
    console.error(`  Status Text: ${error.response?.statusText}`);
    console.error(`  Headers:`, error.response?.headers);
    console.error(`  Data:`, JSON.stringify(error.response?.data, null, 2));
    
    // Check if menu exists
    console.log('\n🔍 Checking if menu exists...');
    try {
      const client = new Client({ channelAccessToken: channelAccessToken! });
      const richMenuList = await client.getRichMenuList();
      const menuExists = richMenuList.find(m => m.richMenuId === menuId);
      
      if (menuExists) {
        console.log('✅ Menu exists:', menuExists.name);
        console.log('   Size:', menuExists.size);
        console.log('   Areas:', menuExists.areas.length);
      } else {
        console.log('❌ Menu NOT found in LINE!');
        console.log('Available menus:');
        richMenuList.forEach(m => console.log(`   - ${m.richMenuId}: ${m.name}`));
      }
    } catch (e: any) {
      console.error('Error checking menus:', e.message);
    }
  }
}

debugUpload();
