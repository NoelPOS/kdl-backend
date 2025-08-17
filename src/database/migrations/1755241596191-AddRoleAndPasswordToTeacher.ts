import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoleAndPasswordToTeacher1755241596191
  implements MigrationInterface
{
  name = 'AddRoleAndPasswordToTeacher1755241596191';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teachers" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );

    // Add password column as nullable first
    await queryRunner.query(
      `ALTER TABLE "teachers" ADD "password" character varying`,
    );

    // Update existing teachers with a default hashed password (password123)
    // This is a bcrypt hash of "password123" with salt rounds 10
    await queryRunner.query(
      `UPDATE "teachers" SET "password" = '$2b$10$2TVfn.3A/AybGNW/0VCyWOiKJPPytcFMP5k9K/oQ0Sv4PtKIS/u0G' WHERE "password" IS NULL`,
    );

    // Now make the password column NOT NULL
    await queryRunner.query(
      `ALTER TABLE "teachers" ALTER COLUMN "password" SET NOT NULL`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."teachers_role_enum" AS ENUM('admin', 'registrar', 'teacher')`,
    );
    await queryRunner.query(
      `ALTER TABLE "teachers" ADD "role" "public"."teachers_role_enum" NOT NULL DEFAULT 'teacher'`,
    );

    // Remove columns we don't need anymore
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "isVerified"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "refreshToken"`,
    );

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'registrar', 'teacher')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" "public"."users_role_enum" NOT NULL DEFAULT 'registrar'`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ALTER COLUMN "allergic" SET DEFAULT ARRAY[]::text[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ALTER COLUMN "doNotEat" SET DEFAULT ARRAY[]::text[]`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "students" ALTER COLUMN "doNotEat" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ALTER COLUMN "allergic" DROP DEFAULT`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" character varying NOT NULL DEFAULT 'user'`,
    );

    // Add back the removed columns if needed (or leave as comment for manual handling)
    // await queryRunner.query(`ALTER TABLE "users" ADD "refreshToken" character varying`);
    // await queryRunner.query(`ALTER TABLE "users" ADD "isVerified" boolean NOT NULL DEFAULT false`);

    await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "role"`);
    await queryRunner.query(`DROP TYPE "public"."teachers_role_enum"`);
    await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "password"`);
    await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "updatedAt"`);
  }
}
