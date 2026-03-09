import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoursePackageVersioning1772150400000
  implements MigrationInterface
{
  name = 'AddCoursePackageVersioning1772150400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add effectiveStartDate with a temporary default so existing rows get a value
    await queryRunner.query(`
            ALTER TABLE "course_packages"
            ADD COLUMN "effectiveStartDate" TIMESTAMP NOT NULL DEFAULT now()
        `);

    // Backfill: set effectiveStartDate = createdAt for all existing rows
    await queryRunner.query(`
            UPDATE "course_packages" SET "effectiveStartDate" = "createdAt"
        `);

    // Add effectiveEndDate (nullable — NULL means currently active)
    await queryRunner.query(`
            ALTER TABLE "course_packages"
            ADD COLUMN "effectiveEndDate" TIMESTAMP NULL
        `);

    // Add index to speed up "find active package by name" queries
    await queryRunner.query(`
            CREATE INDEX "idx_course_packages_active"
            ON "course_packages" ("name", "effectiveEndDate")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_course_packages_active"`);
    await queryRunner.query(
      `ALTER TABLE "course_packages" DROP COLUMN "effectiveEndDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_packages" DROP COLUMN "effectiveStartDate"`,
    );
  }
}
