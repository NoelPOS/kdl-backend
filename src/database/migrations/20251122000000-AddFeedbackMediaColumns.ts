import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFeedbackMediaColumns20251122000000 implements MigrationInterface {
    name = 'AddFeedbackMediaColumns20251122000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add feedback media columns to schedules table
        // Using TEXT type to store comma-separated URLs (simple-array in TypeORM)
        await queryRunner.query(`
            ALTER TABLE "schedules" 
            ADD COLUMN "feedbackImages" text,
            ADD COLUMN "feedbackVideos" text
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove feedback media columns
        await queryRunner.query(`
            ALTER TABLE "schedules" 
            DROP COLUMN "feedbackImages",
            DROP COLUMN "feedbackVideos"
        `);
    }
}
