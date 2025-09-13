import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCommentToSession1726056000000 implements MigrationInterface {
    name = 'AddCommentToSession1726056000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sessions" ADD "comment" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "comment"`);
    }
}
