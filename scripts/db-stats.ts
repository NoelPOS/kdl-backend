/**
 * Database Stats - Show record counts for all tables
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
  });
  
  console.log('🔌 Connecting to database...');
  await ds.initialize();
  
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    Database Stats                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const tables = [
    'students', 
    'parents', 
    'parent_students', 
    'courses', 
    'teachers', 
    'class_options', 
    'sessions', 
    'schedules', 
    'invoices', 
    'receipts', 
    'invoice_items',
    'course_plus',
    'users',
    'rooms'
  ];
  
  for (const table of tables) {
    try {
      const result = await ds.query(`SELECT COUNT(*) FROM "${table}"`);
      console.log(`   ${table.padEnd(20)} : ${result[0].count}`);
    } catch (e: any) {
      console.log(`   ${table.padEnd(20)} : (not found)`);
    }
  }
  
  // Session status breakdown
  console.log('\n📊 Session Status Breakdown:');
  const statusBreakdown = await ds.query(`SELECT status, COUNT(*) as count FROM sessions GROUP BY status ORDER BY count DESC`);
  statusBreakdown.forEach((r: any) => console.log(`   ${r.status.padEnd(20)} : ${r.count}`));
  
  // Payment status breakdown
  console.log('\n💰 Session Payment Breakdown:');
  const paymentBreakdown = await ds.query(`SELECT payment, COUNT(*) as count FROM sessions GROUP BY payment ORDER BY count DESC`);
  paymentBreakdown.forEach((r: any) => console.log(`   ${r.payment.padEnd(20)} : ${r.count}`));
  
  await ds.destroy();
  console.log('\n✅ Done!');
}

main().catch(console.error);
