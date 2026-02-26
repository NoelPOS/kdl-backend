import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();
  
  const result = await client.query(`
    SELECT tc.id, tc."teacherId", tc."courseId", c.title as "courseTitle"
    FROM teacher_courses tc
    LEFT JOIN courses c ON tc."courseId" = c.id
    ORDER BY tc.id
    LIMIT 30
  `);
  
  console.log('Teacher Courses (first 30):');
  console.log('ID | TeacherID | CourseID | Course Title');
  console.log('---|-----------|----------|-------------');
  result.rows.forEach((row: any) => {
    console.log(`${row.id} | ${row.teacherId} | ${row.courseId} | ${row.courseTitle || 'NULL'}`);
  });
  
  console.log(`\nTotal teacher_courses records: ${result.rows.length}`);
  
  // Check for specific problem: Robomaster (27) vs Machine Learning (54)
  const roboCheck = await client.query(`
    SELECT COUNT(*) as count
    FROM teacher_courses
    WHERE "courseId" = 27
  `);
  
  const mlCheck = await client.query(`
    SELECT COUNT(*) as count
    FROM teacher_courses
    WHERE "courseId" = 54
  `);
  
  console.log(`\nTeachers assigned to Robomaster (ID 27): ${roboCheck.rows[0].count}`);
  console.log(`Teachers assigned to Machine Learning I (ID 54): ${mlCheck.rows[0].count}`);
  
  await client.end();
}

main().catch(console.error);
