import { MigrationInterface, QueryRunner } from "typeorm";

export class FixRDSTableStructure20250924103400 implements MigrationInterface {
    name = 'FixRDSTableStructure20250924103400'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Fix student_counters table structure
        const studentCountersColumns = await queryRunner.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'student_counters' AND table_schema = 'public'
        `);
        
        const hasYearColumn = studentCountersColumns.some((col: any) => col.column_name === 'year');
        const hasYearMonthColumn = studentCountersColumns.some((col: any) => col.column_name === 'yearMonth');
        
        if (hasYearColumn && !hasYearMonthColumn) {
            console.log('Fixing student_counters table structure...');
            
            // Drop and recreate with correct structure
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

        // Fix parent_students table - add missing isPrimary column
        const parentStudentsColumns = await queryRunner.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'parent_students' AND table_schema = 'public'
        `);
        
        const hasIsPrimaryColumn = parentStudentsColumns.some((col: any) => col.column_name === 'isPrimary');
        
        if (!hasIsPrimaryColumn) {
            console.log('Adding isPrimary column to parent_students table...');
            await queryRunner.query(`
                ALTER TABLE "parent_students" 
                ADD COLUMN "isPrimary" boolean NOT NULL DEFAULT false
            `);
        }

        // Fix schedules table - add missing feedback modification tracking columns
        const schedulesColumns = await queryRunner.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'schedules' AND table_schema = 'public'
        `);
        
        const hasFeedbackModifiedByName = schedulesColumns.some((col: any) => col.column_name === 'feedbackModifiedByName');
        const hasFeedbackModifiedAt = schedulesColumns.some((col: any) => col.column_name === 'feedbackModifiedAt');
        
        if (!hasFeedbackModifiedByName) {
            console.log('Adding feedbackModifiedByName column to schedules table...');
            await queryRunner.query(`
                ALTER TABLE "schedules" 
                ADD COLUMN "feedbackModifiedByName" character varying
            `);
        }
        
        if (!hasFeedbackModifiedAt) {
            console.log('Adding feedbackModifiedAt column to schedules table...');
            await queryRunner.query(`
                ALTER TABLE "schedules" 
                ADD COLUMN "feedbackModifiedAt" TIMESTAMP
            `);
        }

        // Ensure all required columns exist in all tables
        console.log('Database structure alignment completed');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert student_counters table
        await queryRunner.query(`DROP TABLE IF EXISTS "student_counters"`);
        await queryRunner.query(`
            CREATE TABLE "student_counters" (
                "id" SERIAL NOT NULL,
                "year" integer NOT NULL,
                "count" integer NOT NULL DEFAULT 1,
                CONSTRAINT "UQ_student_counter_year" UNIQUE ("year"),
                CONSTRAINT "PK_student_counter" PRIMARY KEY ("id")
            )
        `);
        
        // Remove isPrimary column from parent_students
        const parentStudentsColumns = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'parent_students' AND column_name = 'isPrimary' AND table_schema = 'public'
        `);
        
        if (parentStudentsColumns.length > 0) {
            await queryRunner.query(`ALTER TABLE "parent_students" DROP COLUMN "isPrimary"`);
        }

        // Remove feedback modification tracking columns from schedules
        const schedulesColumns = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'schedules' AND table_schema = 'public' 
            AND column_name IN ('feedbackModifiedByName', 'feedbackModifiedAt')
        `);
        
        for (const column of schedulesColumns) {
            await queryRunner.query(`ALTER TABLE "schedules" DROP COLUMN "${column.column_name}"`);
        }
    }
}