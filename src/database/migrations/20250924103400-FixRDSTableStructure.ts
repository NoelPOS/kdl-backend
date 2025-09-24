import { MigrationInterface, QueryRunner } from "typeorm";

export class FixRDSTableStructure20250924103400 implements MigrationInterface {
    name = 'FixRDSTableStructure20250924103400'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if student_counters table has the wrong structure and fix it
        const studentCountersColumns = await queryRunner.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'student_counters' AND table_schema = 'public'
        `);
        
        const hasYearColumn = studentCountersColumns.some((col: any) => col.column_name === 'year');
        const hasYearMonthColumn = studentCountersColumns.some((col: any) => col.column_name === 'yearMonth');
        
        if (hasYearColumn && !hasYearMonthColumn) {
            // RDS has wrong structure, fix it
            console.log('Fixing student_counters table structure...');
            
            // Drop the existing table and recreate with correct structure
            await queryRunner.query(`DROP TABLE IF EXISTS "student_counters"`);
            
            await queryRunner.query(`
                CREATE TABLE "student_counters" (
                    "id" SERIAL NOT NULL,
                    "yearMonth" character varying NOT NULL,
                    "counter" integer NOT NULL DEFAULT 0,
                    CONSTRAINT "UQ_1c8806d0063172cc5c141954d5c" UNIQUE ("yearMonth"),
                    CONSTRAINT "PK_fb50ce9edb637ad30f49c00ac54" PRIMARY KEY ("id")
                )
            `);
        }

        // Table names are now consistent between Neon and RDS (both use plural)
        // No table renames needed since both databases now use:
        // - teacher_courses (plural)
        // - parent_students (plural)
        console.log('Table names are already consistent - no renames needed');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert changes if needed
        await queryRunner.query(`DROP TABLE IF EXISTS "student_counters"`);
        
        // Recreate with old structure if reverting
        await queryRunner.query(`
            CREATE TABLE "student_counters" (
                "id" SERIAL NOT NULL,
                "year" integer NOT NULL,
                "count" integer NOT NULL DEFAULT 1,
                CONSTRAINT "UQ_student_counter_year" UNIQUE ("year"),
                CONSTRAINT "PK_student_counter" PRIMARY KEY ("id")
            )
        `);
        
        // No need to revert table names since both databases use consistent plural naming
    }
}