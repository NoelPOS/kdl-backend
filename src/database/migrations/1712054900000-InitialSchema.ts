import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1712054900000 implements MigrationInterface {
    name = 'InitialSchema1712054900000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "userName" character varying NOT NULL,
                "email" character varying NOT NULL,
                "password" character varying NOT NULL,
                "twoFASecret" text,
                "enable2FA" boolean NOT NULL DEFAULT false,
                "apiKey" text NOT NULL,
                "role" character varying NOT NULL DEFAULT 'user',
                CONSTRAINT "UQ_email" UNIQUE ("email"),
                CONSTRAINT "PK_users" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "users"`);
    }
} 