/**
 * Delete teachers except Goldenfold and Meeseeks
 * Usage: npx ts-node scripts/delete-teachers.ts
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';

async function deleteTeachers() {
  console.log('🔄 Connecting to database...');
  
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Connected');

    // Get IDs of teachers to keep
    const keepTeachers = await dataSource.query(
      "SELECT id FROM teachers WHERE LOWER(name) IN ('goldenfold', 'meeseeks')"
    );
    const keepIds = keepTeachers.map((t: any) => t.id);
    console.log('Keeping teacher IDs:', keepIds);

    if (keepIds.length === 0) {
      console.log('⚠️  No Goldenfold or Meeseeks found!');
      await dataSource.destroy();
      return;
    }

    // Delete related records first
    await dataSource.query(
      `DELETE FROM teacher_courses WHERE "teacherId" NOT IN (${keepIds.join(',')})`
    );
    console.log('✅ Deleted teacher_courses');

    try {
      await dataSource.query(
        `DELETE FROM teacher_absences WHERE teacher_id NOT IN (${keepIds.join(',')})`
      );
      console.log('✅ Deleted teacher_absences');
    } catch (e) {
      console.log('⚠️  teacher_absences table may not exist or is empty');
    }

    // Now delete teachers
    await dataSource.query(
      "DELETE FROM teachers WHERE LOWER(name) NOT IN ('goldenfold', 'meeseeks')"
    );
    console.log('✅ Deleted unwanted teachers');

    // Show remaining
    const remaining = await dataSource.query('SELECT id, name, email FROM teachers ORDER BY name');
    console.log('\n📊 Remaining teachers:');
    remaining.forEach((t: any) => console.log(`   - ${t.name} (${t.email})`));

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteTeachers();
