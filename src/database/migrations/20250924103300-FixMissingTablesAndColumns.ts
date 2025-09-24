import { MigrationInterface, QueryRunner } from "typeorm";

export class FixMissingTablesAndColumns20250924103300 implements MigrationInterface {
    name = 'FixMissingTablesAndColumns20250924103300'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "allergic" SET DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "doNotEat" SET DEFAULT ARRAY[]::text[]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "doNotEat" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "allergic" SET DEFAULT ARRAY[]`);
    }

}
