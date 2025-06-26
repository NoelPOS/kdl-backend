import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduleIndexes1735228800000 implements MigrationInterface {
  name = 'AddScheduleIndexes1735228800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add indexes for frequently queried columns
    await queryRunner.query(
      `CREATE INDEX "IDX_SCHEDULES_DATE" ON "schedules" ("date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_SCHEDULES_STUDENT_ID" ON "schedules" ("studentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_SCHEDULES_TEACHER_ID" ON "schedules" ("teacherId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_SCHEDULES_SESSION_ID" ON "schedules" ("sessionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_SCHEDULES_COURSE_ID" ON "schedules" ("courseId")`,
    );

    // Composite index for conflict checking (room + date)
    await queryRunner.query(
      `CREATE INDEX "IDX_SCHEDULES_ROOM_DATE" ON "schedules" ("room", "date")`,
    );

    // Composite index for date range queries
    await queryRunner.query(
      `CREATE INDEX "IDX_SCHEDULES_DATE_START_TIME" ON "schedules" ("date", "startTime")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_SCHEDULES_DATE_START_TIME"`);
    await queryRunner.query(`DROP INDEX "IDX_SCHEDULES_ROOM_DATE"`);
    await queryRunner.query(`DROP INDEX "IDX_SCHEDULES_COURSE_ID"`);
    await queryRunner.query(`DROP INDEX "IDX_SCHEDULES_SESSION_ID"`);
    await queryRunner.query(`DROP INDEX "IDX_SCHEDULES_TEACHER_ID"`);
    await queryRunner.query(`DROP INDEX "IDX_SCHEDULES_STUDENT_ID"`);
    await queryRunner.query(`DROP INDEX "IDX_SCHEDULES_DATE"`);
  }
}
