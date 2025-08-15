import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('class_options')
export class ClassOption {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column()
  @ApiProperty({ description: 'Class mode (e.g., online, offline, hybrid)' })
  classMode: string;

  @Column()
  @ApiProperty({ description: 'Maximum number of students in class' })
  classLimit: number;

  @Column('decimal')
  @ApiProperty({ description: 'Tuition fee for this class option' })
  tuitionFee: number;

  @Column()
  @ApiProperty({ description: 'Date when this option becomes effective' })
  effectiveStartDate: Date;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Date when this option expires (optional)' })
  effectiveEndDate: Date;
}
