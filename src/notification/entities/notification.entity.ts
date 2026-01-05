import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column()
  @ApiProperty({ description: 'User ID for whom the notification is intended' })
  userId: number;

  @Column()
  @ApiProperty({ description: 'Notification type (e.g., schedule_cancelled)' })
  type: string;

  @Column()
  @ApiProperty({ description: 'Notification title' })
  title: string;

  @Column()
  @ApiProperty({ description: 'Notification message body' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  @ApiProperty({ description: 'Additional data payload', required: false })
  data: any;

  @Column({ default: false })
  @ApiProperty({ description: 'Read status' })
  isRead: boolean;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
