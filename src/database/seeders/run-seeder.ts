import 'dotenv/config';
import { DataSource } from 'typeorm';
import dataSource from '../data-source';
import { DataSeeder } from './data-seeder';

async function runSeeder() {
  try {
    console.log('🔗 Connecting to database...');
    await dataSource.initialize();
    console.log('✅ Database connection established');

    const seeder = new DataSeeder(dataSource);
    await seeder.seed();

    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('📡 Database connection closed');
  }
}

runSeeder();
