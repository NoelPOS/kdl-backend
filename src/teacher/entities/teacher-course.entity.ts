import { CourseEntity } from '../../course/entities/course.entity';
import { TeacherEntity } from './teacher.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('teacher_courses')
export class TeacherCourseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  teacherId: number;

  @Column({ type: 'int' })
  courseId: number;

  @ManyToOne(() => TeacherEntity)
  @JoinColumn({ name: 'teacherId' })
  teacher: TeacherEntity;

  @ManyToOne(() => CourseEntity)
  @JoinColumn({ name: 'courseId' })
  course: CourseEntity;
}
