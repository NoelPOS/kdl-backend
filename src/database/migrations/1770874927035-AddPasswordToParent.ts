import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordToParent1770874927035 implements MigrationInterface {
    name = 'AddPasswordToParent1770874927035'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "parents" ADD "password" character varying`);
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "allergic" SET DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "doNotEat" SET DEFAULT ARRAY[]::text[]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "doNotEat" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "students" ALTER COLUMN "allergic" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "parents" DROP COLUMN "password"`);
    }

}
