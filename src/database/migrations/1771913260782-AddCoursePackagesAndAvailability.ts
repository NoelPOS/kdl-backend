import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoursePackagesAndAvailability1771913260782
  implements MigrationInterface
{
  name = 'AddCoursePackagesAndAvailability1771913260782';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create course_packages table
    await queryRunner.query(`
            CREATE TABLE "course_packages" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "numberOfCourses" integer NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_course_packages" PRIMARY KEY ("id")
            )
        `);

    // Create teacher_availability table
    await queryRunner.query(`
            CREATE TABLE "teacher_availability" (
                "id" SERIAL NOT NULL,
                "teacherId" integer NOT NULL,
                "date" date NOT NULL,
                "startTime" character varying(10) NOT NULL,
                "endTime" character varying(10) NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_teacher_availability" PRIMARY KEY ("id")
            )
        `);

    // Add index for teacher_availability
    await queryRunner.query(
      `CREATE INDEX "idx_teacher_availability_teacher_date" ON "teacher_availability" ("teacherId", "date")`,
    );

    // Update sessions table
    await queryRunner.query(`ALTER TABLE "sessions" ADD "comment" text`);
    await queryRunner.query(`ALTER TABLE "sessions" ADD "price" numeric(10,2)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "price"`);
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "comment"`);
    await queryRunner.query(
      `DROP INDEX "idx_teacher_availability_teacher_date"`,
    );
    await queryRunner.query(`DROP TABLE "teacher_availability"`);
    await queryRunner.query(`DROP TABLE "course_packages"`);
  }
}
