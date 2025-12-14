import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherAvailability1734142000000 implements MigrationInterface {
  name = 'AddTeacherAvailability1734142000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to teachers table
    await queryRunner.query(`
      ALTER TABLE teachers 
      ADD COLUMN IF NOT EXISTS teacher_type VARCHAR(20) DEFAULT 'full-time'
    `);

    await queryRunner.query(`
      ALTER TABLE teachers 
      ADD COLUMN IF NOT EXISTS working_days TEXT
    `);

    // Create teacher_absences table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS teacher_absences (
        id SERIAL PRIMARY KEY,
        "teacherId" INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        "absenceDate" DATE NOT NULL,
        reason VARCHAR(255),
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_teacher_absences_teacher_id 
      ON teacher_absences("teacherId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_teacher_absences_date 
      ON teacher_absences("absenceDate")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_teacher_absences_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_teacher_absences_teacher_id`);

    // Drop teacher_absences table
    await queryRunner.query(`DROP TABLE IF EXISTS teacher_absences`);

    // Remove columns from teachers table
    await queryRunner.query(`ALTER TABLE teachers DROP COLUMN IF EXISTS working_days`);
    await queryRunner.query(`ALTER TABLE teachers DROP COLUMN IF EXISTS teacher_type`);
  }
}
