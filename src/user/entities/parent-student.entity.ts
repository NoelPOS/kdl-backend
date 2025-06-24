
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('parent_student')
export class ParentStudentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  parentId: number;

  @Column({ type: 'int' })
  studentId: number;

}