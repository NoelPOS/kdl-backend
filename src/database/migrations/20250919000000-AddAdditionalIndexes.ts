import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdditionalIndexes20250919000000 implements MigrationInterface {
    name = 'AddAdditionalIndexes20250919000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add indexes for sessions table (only if they don't exist)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_student_course" ON "sessions" ("studentId", "courseId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_teacher" ON "sessions" ("teacherId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_status" ON "sessions" ("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_payment" ON "sessions" ("payment")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sessions_package_group" ON "sessions" ("packageGroupId")`);

        // Add indexes for students table (only if they don't exist)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_students_name" ON "students" ("name")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_students_school" ON "students" ("school")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_students_phone" ON "students" ("phone")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes for students table (only if they exist)
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_students_phone"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_students_school"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_students_name"`);

        // Drop indexes for sessions table (only if they exist)
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sessions_package_group"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sessions_payment"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sessions_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sessions_teacher"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sessions_student_course"`);
    }
}