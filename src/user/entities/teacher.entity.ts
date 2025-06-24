import { ApiProperty } from "@nestjs/swagger";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";


@Entity("teachers")
export class TeacherEntity{
    @PrimaryGeneratedColumn()
    @ApiProperty({ description: 'Unique identifier' })
    id: number;

    @CreateDateColumn()
    @ApiProperty({ description: 'Creation timestamp' })
    createdAt: Date;

    @Column()
    @ApiProperty({ description: 'Teacher name' })
    name: string;

    @Column()
    @ApiProperty({ description: 'Teacher email' })
    email: string;

    @Column()
    @ApiProperty({ description: 'Teacher contact number' })
    contactNo: string;

    @Column()
    @ApiProperty({ description: 'Teacher line id' })
    lineId: string;

    @Column()
    @ApiProperty({ description: 'Teacher address' })
    address: string;
    }