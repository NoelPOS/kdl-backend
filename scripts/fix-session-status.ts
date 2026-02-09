/**
 * Fix Session Status
 * 
 * Updates all sessions with status 'wip' or 'active' to 'completed'
 * for historical data that is already finished
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Fix Session Status to Completed                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
  });
  
  console.log('🔌 Connecting to database...');
  await ds.initialize();
  console.log('   ✅ Connected\n');
  
  // Check current status distribution
  console.log('📊 Current status distribution:');
  const before = await ds.query("SELECT status, COUNT(*) as count FROM sessions GROUP BY status ORDER BY count DESC");
  before.forEach((r: any) => console.log(`   ${r.status}: ${r.count}`));
  
  // Update all sessions with status 'wip' or 'active' or case variations to 'completed'
  console.log('\n🔄 Updating statuses to "completed"...');
  const result = await ds.query(
    "UPDATE sessions SET status = 'completed' WHERE LOWER(status) IN ('wip', 'active', 'completed') RETURNING id"
  );
  console.log(`   ✅ Updated ${result.length} sessions to 'completed'`);
  
  // Fix 'Cancelled' → 'cancelled'
  const cancelResult = await ds.query(
    "UPDATE sessions SET status = 'cancelled' WHERE LOWER(status) = 'cancelled' AND status != 'cancelled' RETURNING id"
  );
  console.log(`   ✅ Updated ${cancelResult.length} sessions to 'cancelled'`);
  
  // Verify
  console.log('\n📊 New status distribution:');
  const after = await ds.query("SELECT status, COUNT(*) as count FROM sessions GROUP BY status ORDER BY count DESC");
  after.forEach((r: any) => console.log(`   ${r.status}: ${r.count}`));
  
  await ds.destroy();
  console.log('\n✅ Done!');
}

main().catch(console.error);
