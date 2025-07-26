import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDiscountIndexes1737881500000 implements MigrationInterface {
  name = 'AddDiscountIndexes1737881500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add index for effective_end_date (used in findAll to filter active discounts)
    await queryRunner.query(`
      CREATE INDEX "idx_discounts_effective_end_date" 
      ON "discounts" ("effective_end_date")
    `);

    // Add index for title (used in findOne with ILIKE and ordering in findAll)
    await queryRunner.query(`
      CREATE INDEX "idx_discounts_title" 
      ON "discounts" ("title")
    `);

    // Add composite index for title + effective_end_date (used in create method to find existing active discounts)
    await queryRunner.query(`
      CREATE INDEX "idx_discounts_title_end_date" 
      ON "discounts" ("title", "effective_end_date")
    `);

    // Add index for id (although primary key, explicit for update/delete operations)
    // Primary key already has index, so this is not needed

    // Add partial index for active discounts (effective_end_date IS NULL)
    await queryRunner.query(`
      CREATE INDEX "idx_discounts_active" 
      ON "discounts" ("title") 
      WHERE "effective_end_date" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.query(`DROP INDEX "idx_discounts_active"`);
    await queryRunner.query(`DROP INDEX "idx_discounts_title_end_date"`);
    await queryRunner.query(`DROP INDEX "idx_discounts_title"`);
    await queryRunner.query(`DROP INDEX "idx_discounts_effective_end_date"`);
  }
}
