import { CourseEntity } from 'src/course/entities/course.entity';
import { TeacherEntity } from 'src/user/entities/teacher.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('teacher_course')
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
