import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionIndexes1737881400000 implements MigrationInterface {
  name = 'AddSessionIndexes1737881400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add basic indexes for sessions table
    await queryRunner.query(`
      CREATE INDEX "IDX_SESSIONS_STUDENT_ID" ON "sessions" ("studentId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_SESSIONS_COURSE_ID" ON "sessions" ("courseId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_SESSIONS_TEACHER_ID" ON "sessions" ("teacherId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_SESSIONS_PAYMENT" ON "sessions" ("payment")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_SESSIONS_STATUS" ON "sessions" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_SESSIONS_INVOICE_DONE" ON "sessions" ("invoiceDone")
    `);

    // Add composite indexes for common query patterns
    await queryRunner.query(`
      CREATE INDEX "IDX_SESSIONS_STUDENT_PAYMENT" ON "sessions" ("studentId", "payment")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_SESSIONS_STUDENT_STATUS" ON "sessions" ("studentId", "status")
    `);

    // Add index for schedules table to optimize the N+1 query
    await queryRunner.query(`
      CREATE INDEX "IDX_SCHEDULES_SESSION_ATTENDANCE" ON "schedules" ("sessionId", "attendance")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_SCHEDULES_SESSION_ATTENDANCE"`);
    await queryRunner.query(`DROP INDEX "IDX_SESSIONS_STUDENT_STATUS"`);
    await queryRunner.query(`DROP INDEX "IDX_SESSIONS_STUDENT_PAYMENT"`);
    await queryRunner.query(`DROP INDEX "IDX_SESSIONS_INVOICE_DONE"`);
    await queryRunner.query(`DROP INDEX "IDX_SESSIONS_STATUS"`);
    await queryRunner.query(`DROP INDEX "IDX_SESSIONS_PAYMENT"`);
    await queryRunner.query(`DROP INDEX "IDX_SESSIONS_TEACHER_ID"`);
    await queryRunner.query(`DROP INDEX "IDX_SESSIONS_COURSE_ID"`);
    await queryRunner.query(`DROP INDEX "IDX_SESSIONS_STUDENT_ID"`);
  }
}
