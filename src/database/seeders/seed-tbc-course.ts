import 'dotenv/config';
import dataSource from '../data-source';

async function seedTbcCourse() {
  try {
    console.log('🔗 Connecting to database...');
    await dataSource.initialize();
    console.log('✅ Connected');

    const existing = await dataSource.query(
      `SELECT id FROM courses WHERE title ILIKE '%TBC%' LIMIT 1`
    );

    if (existing.length > 0) {
      console.log(`ℹ️  TBC course already exists (id=${existing[0].id}), nothing to do.`);
    } else {
      const result = await dataSource.query(
        `INSERT INTO courses (title, description, "ageRange", medium) VALUES ($1, $2, $3, $4) RETURNING id`,
        ['TBC', '', '-', '-']
      );
      console.log(`✅ TBC course created (id=${result[0].id})`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('📡 Connection closed');
  }
}

seedTbcCourse();
