import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSessionsSchedulesIndexes20250919000001 implements MigrationInterface {
    name = 'AddSessionsSchedulesIndexes20250919000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 🔥 SESSIONS TABLE - High-impact indexes for core queries
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_student_course" ON "sessions" ("studentId", "courseId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_teacher" ON "sessions" ("teacherId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_status" ON "sessions" ("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_payment" ON "sessions" ("payment")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_package_group" ON "sessions" ("packageGroupId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_student_package" ON "sessions" ("studentId", "packageGroupId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_status_payment" ON "sessions" ("status", "payment")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_created_at" ON "sessions" ("createdAt")`);

        // 📅 SCHEDULES TABLE - High-impact indexes for scheduling & feedback
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_schedules_feedback_verify" ON "schedules" ("verifyFb", "feedback")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_schedules_feedback_date" ON "schedules" ("feedbackDate")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_schedules_attendance" ON "schedules" ("attendance")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_schedules_date_attendance" ON "schedules" ("date", "attendance")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_schedules_session_id" ON "schedules" ("sessionId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop schedules indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_schedules_session_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_schedules_date_attendance"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_schedules_attendance"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_schedules_feedback_date"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_schedules_feedback_verify"`);

        // Drop sessions indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sessions_created_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sessions_status_payment"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sessions_student_package"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sessions_package_group"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sessions_payment"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sessions_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sessions_teacher"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sessions_student_course"`);
    }
}