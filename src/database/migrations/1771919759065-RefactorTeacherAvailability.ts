import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorTeacherAvailability1771919759065 implements MigrationInterface {
    name = 'RefactorTeacherAvailability1771919759065'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_teacher_availability_teacher_date"`);
        await queryRunner.query(`DELETE FROM "teacher_availability"`);
        await queryRunner.query(`ALTER TABLE "teacher_availability" DROP COLUMN "date"`);
        await queryRunner.query(`ALTER TABLE "teacher_availability" ADD "dayOfWeek" character varying(15) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "allergic" SET DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "doNotEat" SET DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`CREATE INDEX "idx_teacher_availability_teacher_day" ON "teacher_availability" ("teacherId", "dayOfWeek") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_teacher_availability_teacher_day"`);
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "doNotEat" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "allergic" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "teacher_availability" DROP COLUMN "dayOfWeek"`);
        await queryRunner.query(`ALTER TABLE "teacher_availability" ADD "date" date NOT NULL`);
        await queryRunner.query(`CREATE INDEX "idx_teacher_availability_teacher_date" ON "teacher_availability" ("date", "teacherId") `);
    }

}
