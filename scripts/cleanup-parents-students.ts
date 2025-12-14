/**
 * Delete specific parents and students
 * Keep: Beth Smith, Jerry Smith, Rick Sanches (parents)
 * Keep: Morty Smith, Summer Smith (students)
 * 
 * Usage: npx ts-node scripts/cleanup-parents-students.ts
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';

async function cleanup() {
  console.log('🔄 Connecting to database...');
  
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Connected\n');

    // ===== PARENTS =====
    console.log('📋 PARENTS:');
    
    // Delete parent_students relationship first for parents to be deleted
    const parentsToDelete = await dataSource.query(
      "SELECT id, name FROM parents WHERE LOWER(name) IN ('john', 'test parent')"
    );
    console.log('Parents to delete:', parentsToDelete.map((p: any) => p.name));

    if (parentsToDelete.length > 0) {
      const parentIds = parentsToDelete.map((p: any) => p.id);
      
      // Delete parent_students relationships
      await dataSource.query(
        `DELETE FROM parent_students WHERE "parentId" IN (${parentIds.join(',')})`
      );
      console.log('✅ Deleted parent_students relationships');

      // Delete parents
      await dataSource.query(
        "DELETE FROM parents WHERE LOWER(name) IN ('john', 'test parent')"
      );
      console.log('✅ Deleted parents: John, Test Parent');
    }

    // Show remaining parents
    const remainingParents = await dataSource.query('SELECT name, email FROM parents ORDER BY name');
    console.log('\n📊 Remaining parents:');
    remainingParents.forEach((p: any) => console.log(`   - ${p.name} (${p.email})`));

    // ===== STUDENTS =====
    console.log('\n📋 STUDENTS:');
    
    // Get students to keep
    const studentsToKeep = await dataSource.query(
      "SELECT id, name FROM students WHERE LOWER(name) IN ('morty smith', 'summer smith')"
    );
    console.log('Students to keep:', studentsToKeep.map((s: any) => s.name));

    if (studentsToKeep.length > 0) {
      const keepStudentIds = studentsToKeep.map((s: any) => s.id);
      
      // Delete parent_students for students to be deleted
      await dataSource.query(
        `DELETE FROM parent_students WHERE "studentId" NOT IN (${keepStudentIds.join(',')})`
      );
      console.log('✅ Deleted parent_students for other students');

      // Delete students (only those not Morty or Summer)
      await dataSource.query(
        "DELETE FROM students WHERE LOWER(name) NOT IN ('morty smith', 'summer smith')"
      );
      console.log('✅ Deleted other students');
    }

    // Show remaining students
    const remainingStudents = await dataSource.query('SELECT name, "studentId" FROM students ORDER BY name');
    console.log('\n📊 Remaining students:');
    remainingStudents.forEach((s: any) => console.log(`   - ${s.name} (ID: ${s.studentId})`));

    await dataSource.destroy();
    console.log('\n✅ Cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanup();
