import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1712054900000 implements MigrationInterface {
  name = 'InitialSchema1712054900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Users table
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "userName" character varying NOT NULL,
                "email" character varying NOT NULL,
                "password" character varying NOT NULL,
                "role" character varying NOT NULL DEFAULT 'user',
                "refreshToken" text,
                "isVerified" boolean NOT NULL DEFAULT false,
                CONSTRAINT "UQ_email" UNIQUE ("email"),
                CONSTRAINT "PK_users" PRIMARY KEY ("id")
            )
        `);

    // Tokens table
    await queryRunner.query(`
            CREATE TABLE "tokens" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" character varying NOT NULL,
                "token" character varying NOT NULL,
                "type" character varying NOT NULL,
                "expireIn" TIMESTAMP NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_tokens" PRIMARY KEY ("id")
            )
        `);

    // Students table
    await queryRunner.query(`
            CREATE TABLE "students" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "name" character varying NOT NULL,
                "nickname" character varying NOT NULL,
                "dob" character varying NOT NULL,
                "gender" character varying NOT NULL,
                "school" character varying NOT NULL,
                "allergic" text array DEFAULT ARRAY[]::text[],
                "doNotEat" text array DEFAULT ARRAY[]::text[],
                "adConcent" boolean NOT NULL,
                "phone" character varying NOT NULL,
                "profilePicture" character varying NOT NULL,
                CONSTRAINT "PK_students" PRIMARY KEY ("id")
            )
        `);

    // Teachers table
    await queryRunner.query(`
            CREATE TABLE "teachers" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "name" character varying NOT NULL,
                "email" character varying NOT NULL,
                "contactNo" character varying NOT NULL,
                "lineId" character varying NOT NULL,
                "address" character varying NOT NULL,
                "profilePicture" character varying NOT NULL,
                CONSTRAINT "PK_teachers" PRIMARY KEY ("id")
            )
        `);

    // Parents table
    await queryRunner.query(`
            CREATE TABLE "parents" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "name" character varying NOT NULL,
                "email" character varying NOT NULL,
                "contactNo" character varying NOT NULL,
                "lineId" character varying NOT NULL,
                "address" character varying NOT NULL,
                CONSTRAINT "PK_parents" PRIMARY KEY ("id")
            )
        `);

    // Courses table
    await queryRunner.query(`
            CREATE TABLE "courses" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "title" character varying NOT NULL,
                "description" character varying NOT NULL,
                "ageRange" character varying NOT NULL,
                "medium" character varying NOT NULL,
                CONSTRAINT "PK_courses" PRIMARY KEY ("id")
            )
        `);

    // Sessions table
    await queryRunner.query(`
            CREATE TABLE "sessions" (
                "id" SERIAL NOT NULL,
                "studentId" integer NOT NULL,
                "courseId" integer NOT NULL,
                "mode" character varying NOT NULL,
                "classLimit" integer NOT NULL,
                "classCancel" integer NOT NULL,
                "payment" character varying NOT NULL,
                "status" character varying NOT NULL,
                CONSTRAINT "PK_sessions" PRIMARY KEY ("id")
            )
        `);

    // Schedules table
    await queryRunner.query(`
            CREATE TABLE "schedules" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "sessionId" integer NOT NULL,
                "courseId" integer NOT NULL,
                "studentId" integer NOT NULL,
                "teacherId" integer NOT NULL,
                "date" TIMESTAMP NOT NULL,
                "startTime" character varying NOT NULL,
                "endTime" character varying NOT NULL,
                "room" character varying NOT NULL,
                "attendance" character varying NOT NULL,
                "remark" character varying NOT NULL,
                "warning" character varying NOT NULL,
                "feedback" character varying NOT NULL,
                "verifyFb" boolean NOT NULL,
                "classNumber" integer,
                CONSTRAINT "PK_schedules" PRIMARY KEY ("id")
            )
        `);

    // Rooms table
    await queryRunner.query(`
            CREATE TABLE "rooms" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                CONSTRAINT "PK_rooms" PRIMARY KEY ("id")
            )
        `);

    // Discounts table
    await queryRunner.query(`
            CREATE TABLE "discounts" (
                "id" SERIAL NOT NULL,
                "title" character varying NOT NULL,
                "amount" integer NOT NULL,
                CONSTRAINT "PK_discounts" PRIMARY KEY ("id")
            )
        `);

    // Teacher-Course junction table
    await queryRunner.query(`
            CREATE TABLE "teacher_course" (
                "id" SERIAL NOT NULL,
                "teacherId" integer NOT NULL,
                "courseId" integer NOT NULL,
                CONSTRAINT "PK_teacher_course" PRIMARY KEY ("id")
            )
        `);

    // Parent-Student junction table
    await queryRunner.query(`
            CREATE TABLE "parent_student" (
                "id" SERIAL NOT NULL,
                "parentId" integer NOT NULL,
                "studentId" integer NOT NULL,
                CONSTRAINT "PK_parent_student" PRIMARY KEY ("id")
            )
        `);

    // Add foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "tokens" ADD CONSTRAINT "FK_tokens_user" 
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "sessions" ADD CONSTRAINT "FK_sessions_course" 
            FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "schedules" ADD CONSTRAINT "FK_schedules_session" 
            FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "schedules" ADD CONSTRAINT "FK_schedules_course" 
            FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "schedules" ADD CONSTRAINT "FK_schedules_student" 
            FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "schedules" ADD CONSTRAINT "FK_schedules_teacher" 
            FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "teacher_course" ADD CONSTRAINT "FK_teacher_course_teacher" 
            FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "teacher_course" ADD CONSTRAINT "FK_teacher_course_course" 
            FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "parent_student" ADD CONSTRAINT "FK_parent_student_parent" 
            FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "parent_student" ADD CONSTRAINT "FK_parent_student_student" 
            FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints first
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP CONSTRAINT "FK_tokens_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_sessions_course"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedules" DROP CONSTRAINT "FK_schedules_session"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedules" DROP CONSTRAINT "FK_schedules_course"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedules" DROP CONSTRAINT "FK_schedules_student"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedules" DROP CONSTRAINT "FK_schedules_teacher"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_course" DROP CONSTRAINT "FK_teacher_course_teacher"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_course" DROP CONSTRAINT "FK_teacher_course_course"`,
    );
    await queryRunner.query(
      `ALTER TABLE "parent_student" DROP CONSTRAINT "FK_parent_student_parent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "parent_student" DROP CONSTRAINT "FK_parent_student_student"`,
    );

    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "parent_student"`);
    await queryRunner.query(`DROP TABLE "teacher_course"`);
    await queryRunner.query(`DROP TABLE "discounts"`);
    await queryRunner.query(`DROP TABLE "rooms"`);
    await queryRunner.query(`DROP TABLE "schedules"`);
    await queryRunner.query(`DROP TABLE "sessions"`);
    await queryRunner.query(`DROP TABLE "courses"`);
    await queryRunner.query(`DROP TABLE "parents"`);
    await queryRunner.query(`DROP TABLE "teachers"`);
    await queryRunner.query(`DROP TABLE "students"`);
    await queryRunner.query(`DROP TABLE "tokens"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
