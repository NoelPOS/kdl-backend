import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialCreateAllTables20250914005103 implements MigrationInterface {
    name = 'InitialCreateAllTables20250914005103'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum types
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'registrar', 'teacher')`);
        await queryRunner.query(`CREATE TYPE "public"."teachers_role_enum" AS ENUM('admin', 'registrar', 'teacher')`);

        // Create users table
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "userName" character varying NOT NULL,
                "email" character varying NOT NULL,
                "password" character varying NOT NULL,
                "role" "public"."users_role_enum" NOT NULL DEFAULT 'registrar',
                "profilePicture" character varying NOT NULL DEFAULT '',
                "profileKey" character varying,
                CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);

        // Create students table
        await queryRunner.query(`
            CREATE TABLE "students" (
                "id" SERIAL NOT NULL,
                "studentId" character varying,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "name" character varying NOT NULL,
                "nickname" character varying NOT NULL,
                "nationalId" character varying,
                "dob" character varying NOT NULL,
                "gender" character varying NOT NULL,
                "school" character varying NOT NULL,
                "allergic" text array NOT NULL DEFAULT ARRAY[]::text[],
                "doNotEat" text array NOT NULL DEFAULT ARRAY[]::text[],
                "adConcent" boolean NOT NULL,
                "phone" character varying NOT NULL,
                "profilePicture" character varying NOT NULL,
                "profileKey" character varying,
                CONSTRAINT "UQ_7d7f07271ad4ce999880713f05e" UNIQUE ("studentId"),
                CONSTRAINT "PK_7d7f07271ad4ce999880713f05e" PRIMARY KEY ("id")
            )
        `);

        // Create teachers table
        await queryRunner.query(`
            CREATE TABLE "teachers" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "name" character varying NOT NULL,
                "email" character varying NOT NULL,
                "password" character varying NOT NULL,
                "role" "public"."teachers_role_enum" NOT NULL DEFAULT 'teacher',
                "contactNo" character varying NOT NULL,
                "lineId" character varying NOT NULL,
                "address" character varying NOT NULL,
                "profilePicture" character varying NOT NULL,
                "profileKey" character varying,
                CONSTRAINT "PK_a8d4f83be3abe4c687b0a0093c8" PRIMARY KEY ("id")
            )
        `);

        // Create courses table
        await queryRunner.query(`
            CREATE TABLE "courses" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "title" character varying NOT NULL,
                "description" character varying NOT NULL,
                "ageRange" character varying NOT NULL,
                "medium" character varying NOT NULL,
                CONSTRAINT "PK_3f70a487cc718ad8eda4e6d58c9" PRIMARY KEY ("id")
            )
        `);

        // Create class_options table
        await queryRunner.query(`
            CREATE TABLE "class_options" (
                "id" SERIAL NOT NULL,
                "classMode" character varying NOT NULL,
                "classLimit" integer NOT NULL,
                "tuitionFee" numeric NOT NULL,
                "effectiveStartDate" TIMESTAMP NOT NULL,
                "effectiveEndDate" TIMESTAMP,
                CONSTRAINT "PK_6e632f2dd7f7e1f86e1cbb52f43" PRIMARY KEY ("id")
            )
        `);

        // Create parents table
        await queryRunner.query(`
            CREATE TABLE "parents" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "name" character varying NOT NULL,
                "email" character varying NOT NULL,
                "contactNo" character varying NOT NULL,
                "lineId" character varying NOT NULL,
                "address" character varying NOT NULL,
                "profilePicture" character varying,
                "profileKey" character varying,
                CONSTRAINT "PK_b6f7d1faa48e41a14b5d84e8b6e" PRIMARY KEY ("id")
            )
        `);

        // Create rooms table
        await queryRunner.query(`
            CREATE TABLE "rooms" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id")
            )
        `);

        // Create discounts table
        await queryRunner.query(`
            CREATE TABLE "discounts" (
                "id" SERIAL NOT NULL,
                "title" character varying NOT NULL,
                "usage" character varying NOT NULL,
                "amount" integer NOT NULL,
                "effective_start_date" TIMESTAMP NOT NULL,
                "effective_end_date" TIMESTAMP,
                CONSTRAINT "PK_66c522004212dc814d6e2f14ecc" PRIMARY KEY ("id")
            )
        `);

        // Create sessions table
        await queryRunner.query(`
            CREATE TABLE "sessions" (
                "id" SERIAL NOT NULL,
                "studentId" integer NOT NULL,
                "courseId" integer NOT NULL,
                "classOptionId" integer NOT NULL,
                "classCancel" integer NOT NULL,
                "payment" character varying NOT NULL,
                "status" character varying NOT NULL,
                "teacherId" integer,
                "invoiceDone" boolean NOT NULL DEFAULT false,
                "packageGroupId" integer,
                "comment" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id")
            )
        `);

        // Create schedules table
        await queryRunner.query(`
            CREATE TABLE "schedules" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "sessionId" integer NOT NULL,
                "courseId" integer NOT NULL,
                "studentId" integer NOT NULL,
                "teacherId" integer,
                "date" date,
                "startTime" character varying,
                "endTime" character varying,
                "room" character varying NOT NULL,
                "attendance" character varying NOT NULL,
                "remark" character varying NOT NULL,
                "warning" character varying NOT NULL,
                "feedback" character varying NOT NULL,
                "feedbackDate" TIMESTAMP,
                "verifyFb" boolean NOT NULL,
                "classNumber" integer,
                "coursePlusId" integer,
                CONSTRAINT "PK_7e33fc2ea755a5765eb3564047d" PRIMARY KEY ("id")
            )
        `);

        // Create invoices table
        await queryRunner.query(`
            CREATE TABLE "invoices" (
                "id" SERIAL NOT NULL,
                "documentId" character varying NOT NULL,
                "date" TIMESTAMP NOT NULL,
                "paymentMethod" character varying NOT NULL,
                "totalAmount" numeric NOT NULL,
                "receiptDone" boolean NOT NULL DEFAULT false,
                "studentId" integer NOT NULL,
                "studentName" character varying NOT NULL,
                "courseName" character varying NOT NULL,
                "sessionGroups" json NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id")
            )
        `);

        // Create invoice_items table
        await queryRunner.query(`
            CREATE TABLE "invoice_items" (
                "id" SERIAL NOT NULL,
                "invoiceId" integer NOT NULL,
                "description" character varying NOT NULL,
                "amount" numeric NOT NULL,
                CONSTRAINT "PK_a91fe24f5a3fb39e5ff7b24ad57" PRIMARY KEY ("id")
            )
        `);

        // Create course_plus table
        await queryRunner.query(`
            CREATE TABLE "course_plus" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "sessionId" integer NOT NULL,
                "classNo" integer NOT NULL,
                "amount" integer NOT NULL,
                "description" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'unpaid',
                "invoiceGenerated" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_4b3db17cb0a3e2fa1d8c9e5f1a8" PRIMARY KEY ("id")
            )
        `);

        // Create receipts table
        await queryRunner.query(`
            CREATE TABLE "receipts" (
                "id" SERIAL NOT NULL,
                "invoiceId" integer NOT NULL,
                "date" TIMESTAMP NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_9b2cc9651fa0f6a88b63fb86b4c" PRIMARY KEY ("id")
            )
        `);

        // Create parent_students table (junction table for parent-student relationship)
        await queryRunner.query(`
            CREATE TABLE "parent_students" (
                "id" SERIAL NOT NULL,
                "parentId" integer NOT NULL,
                "studentId" integer NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_8e1c8e8b9b7b6a5b4c3d2e1f0a9" PRIMARY KEY ("id")
            )
        `);

        // Create teacher_courses table (junction table for teacher-course relationship)
        await queryRunner.query(`
            CREATE TABLE "teacher_courses" (
                "id" SERIAL NOT NULL,
                "teacherId" integer NOT NULL,
                "courseId" integer NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_7e1c8e8b9b7b6a5b4c3d2e1f0a8" PRIMARY KEY ("id")
            )
        `);

        // Create student_counters table (for student ID generation)
        await queryRunner.query(`
            CREATE TABLE "student_counters" (
                "id" SERIAL NOT NULL,
                "year" integer NOT NULL,
                "count" integer NOT NULL DEFAULT 1,
                CONSTRAINT "UQ_student_counter_year" UNIQUE ("year"),
                CONSTRAINT "PK_student_counter" PRIMARY KEY ("id")
            )
        `);

        // Create document_counters table (for document ID generation)
        await queryRunner.query(`
            CREATE TABLE "document_counters" (
                "id" SERIAL NOT NULL,
                "year" integer NOT NULL,
                "documentType" character varying NOT NULL,
                "count" integer NOT NULL DEFAULT 1,
                CONSTRAINT "UQ_document_counter_year_type" UNIQUE ("year", "documentType"),
                CONSTRAINT "PK_document_counter" PRIMARY KEY ("id")
            )
        `);

        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "sessions" 
            ADD CONSTRAINT "FK_sessions_courseId" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "sessions" 
            ADD CONSTRAINT "FK_sessions_studentId" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "sessions" 
            ADD CONSTRAINT "FK_sessions_teacherId" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "sessions" 
            ADD CONSTRAINT "FK_sessions_classOptionId" FOREIGN KEY ("classOptionId") REFERENCES "class_options"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "schedules" 
            ADD CONSTRAINT "FK_schedules_sessionId" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "schedules" 
            ADD CONSTRAINT "FK_schedules_courseId" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "schedules" 
            ADD CONSTRAINT "FK_schedules_studentId" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "schedules" 
            ADD CONSTRAINT "FK_schedules_teacherId" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "invoice_items" 
            ADD CONSTRAINT "FK_invoice_items_invoiceId" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "receipts" 
            ADD CONSTRAINT "FK_receipts_invoiceId" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "course_plus" 
            ADD CONSTRAINT "FK_course_plus_sessionId" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "parent_students" 
            ADD CONSTRAINT "FK_parent_students_parentId" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "parent_students" 
            ADD CONSTRAINT "FK_parent_students_studentId" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "teacher_courses" 
            ADD CONSTRAINT "FK_teacher_courses_teacherId" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "teacher_courses" 
            ADD CONSTRAINT "FK_teacher_courses_courseId" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        // Create indexes for better performance
        await queryRunner.query(`CREATE INDEX "idx_schedules_room_date_time" ON "schedules" ("room", "date", "startTime", "endTime")`);
        await queryRunner.query(`CREATE INDEX "idx_schedules_teacher_date_time" ON "schedules" ("teacherId", "date", "startTime", "endTime")`);
        await queryRunner.query(`CREATE INDEX "idx_schedules_student_date_time" ON "schedules" ("studentId", "date", "startTime", "endTime")`);
        await queryRunner.query(`CREATE INDEX "idx_schedules_date" ON "schedules" ("date")`);
        await queryRunner.query(`CREATE INDEX "idx_schedules_studentId" ON "schedules" ("studentId")`);
        await queryRunner.query(`CREATE INDEX "idx_schedules_teacherId" ON "schedules" ("teacherId")`);
        await queryRunner.query(`CREATE INDEX "idx_schedules_room" ON "schedules" ("room")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "public"."idx_schedules_room"`);
        await queryRunner.query(`DROP INDEX "public"."idx_schedules_teacherId"`);
        await queryRunner.query(`DROP INDEX "public"."idx_schedules_studentId"`);
        await queryRunner.query(`DROP INDEX "public"."idx_schedules_date"`);
        await queryRunner.query(`DROP INDEX "public"."idx_schedules_student_date_time"`);
        await queryRunner.query(`DROP INDEX "public"."idx_schedules_teacher_date_time"`);
        await queryRunner.query(`DROP INDEX "public"."idx_schedules_room_date_time"`);

        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "teacher_courses" DROP CONSTRAINT "FK_teacher_courses_courseId"`);
        await queryRunner.query(`ALTER TABLE "teacher_courses" DROP CONSTRAINT "FK_teacher_courses_teacherId"`);
        await queryRunner.query(`ALTER TABLE "parent_students" DROP CONSTRAINT "FK_parent_students_studentId"`);
        await queryRunner.query(`ALTER TABLE "parent_students" DROP CONSTRAINT "FK_parent_students_parentId"`);
        await queryRunner.query(`ALTER TABLE "course_plus" DROP CONSTRAINT "FK_course_plus_sessionId"`);
        await queryRunner.query(`ALTER TABLE "receipts" DROP CONSTRAINT "FK_receipts_invoiceId"`);
        await queryRunner.query(`ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_invoice_items_invoiceId"`);
        await queryRunner.query(`ALTER TABLE "schedules" DROP CONSTRAINT "FK_schedules_teacherId"`);
        await queryRunner.query(`ALTER TABLE "schedules" DROP CONSTRAINT "FK_schedules_studentId"`);
        await queryRunner.query(`ALTER TABLE "schedules" DROP CONSTRAINT "FK_schedules_courseId"`);
        await queryRunner.query(`ALTER TABLE "schedules" DROP CONSTRAINT "FK_schedules_sessionId"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_sessions_classOptionId"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_sessions_teacherId"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_sessions_studentId"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_sessions_courseId"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE "document_counters"`);
        await queryRunner.query(`DROP TABLE "student_counters"`);
        await queryRunner.query(`DROP TABLE "teacher_courses"`);
        await queryRunner.query(`DROP TABLE "parent_students"`);
        await queryRunner.query(`DROP TABLE "receipts"`);
        await queryRunner.query(`DROP TABLE "course_plus"`);
        await queryRunner.query(`DROP TABLE "invoice_items"`);
        await queryRunner.query(`DROP TABLE "invoices"`);
        await queryRunner.query(`DROP TABLE "schedules"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP TABLE "discounts"`);
        await queryRunner.query(`DROP TABLE "rooms"`);
        await queryRunner.query(`DROP TABLE "parents"`);
        await queryRunner.query(`DROP TABLE "class_options"`);
        await queryRunner.query(`DROP TABLE "courses"`);
        await queryRunner.query(`DROP TABLE "teachers"`);
        await queryRunner.query(`DROP TABLE "students"`);
        await queryRunner.query(`DROP TABLE "users"`);

        // Drop enum types
        await queryRunner.query(`DROP TYPE "public"."teachers_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }
}