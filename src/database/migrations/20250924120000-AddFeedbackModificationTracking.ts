import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeedbackModificationTracking20250924120000
  implements MigrationInterface
{
  name = 'AddFeedbackModificationTracking20250924120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add feedback modification tracking columns to schedules table if they don't exist
    await queryRunner.query(`
            ALTER TABLE "schedules" 
            ADD COLUMN IF NOT EXISTS "feedbackModifiedByName" character varying,
            ADD COLUMN IF NOT EXISTS "feedbackModifiedAt" TIMESTAMP
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove feedback modification tracking columns
    await queryRunner.query(`
            ALTER TABLE "schedules" 
            DROP COLUMN "feedbackModifiedByName",
            DROP COLUMN "feedbackModifiedAt"
        `);
  }
}
