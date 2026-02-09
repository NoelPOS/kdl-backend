/**
 * Fix Schedule Attendance Status
 * 
 * Normalizes attendance values from 'Completed' to 'completed' (lowercase)
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Fix Schedule Attendance Status                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
  });
  
  console.log('🔌 Connecting to database...');
  await ds.initialize();
  console.log('   ✅ Connected\n');
  
  // Check current attendance distribution
  console.log('📊 Current attendance distribution:');
  const before = await ds.query(`SELECT attendance, COUNT(*) as count FROM schedules GROUP BY attendance ORDER BY count DESC`);
  before.forEach((r: any) => console.log(`   ${(r.attendance || 'null').padEnd(20)} : ${r.count}`));
  
  // Normalize all attendance values to lowercase
  console.log('\n🔄 Normalizing all attendance values to lowercase...');
  
  const updates = [
    { from: 'Completed', to: 'completed' },
    { from: 'Pending', to: 'pending' },
    { from: 'Cancelled', to: 'cancelled' },
    { from: 'Absent', to: 'absent' },
    { from: 'Confirmed', to: 'confirmed' },
  ];
  
  for (const { from, to } of updates) {
    const result = await ds.query(
      `UPDATE schedules SET attendance = $1 WHERE attendance = $2 RETURNING id`,
      [to, from]
    );
    if (result.length > 0) {
      console.log(`   ✅ Updated ${result.length} schedules: '${from}' → '${to}'`);
    }
  }
  
  // Verify
  console.log('\n📊 New attendance distribution:');
  const after = await ds.query(`SELECT attendance, COUNT(*) as count FROM schedules GROUP BY attendance ORDER BY count DESC`);
  after.forEach((r: any) => console.log(`   ${(r.attendance || 'null').padEnd(20)} : ${r.count}`));
  
  await ds.destroy();
  console.log('\n✅ Done!');
}

main().catch(console.error);
