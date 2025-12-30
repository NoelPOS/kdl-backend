/**
 * Cleanup Script: Delete all sessions, schedules, receipts, and invoices
 * Usage: npx ts-node scripts/cleanup-data.ts
 * 
 * This uses your existing DATABASE_URL from .env
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';

async function cleanupData() {
  console.log('🔄 Connecting to database...');
  
  const isProd = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('amazonaws');
  
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
    logging: true,
    ssl: isProd ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Connected to database');

    const queryRunner = dataSource.createQueryRunner();
    
    console.log('\n⚠️  Starting cleanup - this will delete all data from these tables!\n');

    // Use TRUNCATE with CASCADE to handle FK constraints automatically
    // Order matters if fallback DELETE is used: delete dependents first
    const tables = [
      'receipts', 
      'invoice_items', 
      'invoices', 
      'feedbacks',        // Added
      'teacher_absences', // Added
      'course_plus',      // Added
      'schedules', 
      'sessions'
    ];

    for (const table of tables) {
      try {
        // Try TRUNCATE with CASCADE first
        await queryRunner.query(`TRUNCATE TABLE ${table} CASCADE`);
        console.log(`✅ Truncated ${table}`);
      } catch (error: any) {
        // Fallback to DELETE if TRUNCATE fails
        try {
          await queryRunner.query(`DELETE FROM ${table}`);
          console.log(`✅ Deleted from ${table}`);
        } catch (deleteError: any) {
          console.log(`⚠️  Could not clear ${table}: ${deleteError.message}`);
        }
      }
    }

    console.log('\n✅ Cleanup complete!\n');

    // Show final counts
    console.log('📊 Final counts:');
    for (const table of tables) {
      try {
        const count = await queryRunner.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ${table}: ${count[0].count} rows`);
      } catch (error) {
        console.log(`   ${table}: (table not found)`);
      }
    }

    await queryRunner.release();
    await dataSource.destroy();
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanupData();
