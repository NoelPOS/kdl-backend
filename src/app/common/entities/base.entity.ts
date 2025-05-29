import { CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export abstract class BaseEntity {
    @PrimaryGeneratedColumn()
    @ApiProperty({ description: 'Unique identifier' })
    id: number;

    @CreateDateColumn()
    @ApiProperty({ description: 'Creation timestamp' })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({ description: 'Last update timestamp' })
    updatedAt: Date;
} 