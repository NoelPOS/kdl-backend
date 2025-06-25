import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('parents')
export class ParentEntity {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @Column()
  @ApiProperty({ description: 'Parent name' })
  name: string;

  @Column()
  @ApiProperty({ description: 'Parent email' })
  email: string;

  @Column()
  @ApiProperty({ description: 'Parent contact number' })
  contactNo: string;

  @Column()
  @ApiProperty({ description: 'Parent line id' })
  lineId: string;

  @Column()
  @ApiProperty({ description: 'Parent address' })
  address: string;
}
