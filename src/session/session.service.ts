import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { Repository, ILike, Not } from 'typeorm';
import { Schedule } from '../schedule/entities/schedule.entity';
import { DataSource } from 'typeorm';
import { StudentSessionFilterDto } from './dto/student-session-filter.dto';
import { TeacherSessionFilterDto } from './dto/teacher-session-filter.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { CoursePlus } from '../course-plus/entities/course-plus.entity';
import { AddCoursePlusDto } from './dto/add-course-plus.dto';
// Import separated entities
import { ClassOption } from '../class-option/entities/class-option.entity';
import { CourseEntity } from '../course/entities/course.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { InvoiceItem } from '../invoice/entities/invoice-item.entity';
import { DocumentCounter } from '../invoice/entities/document-counter.entity';
import { Receipt } from '../receipt/entities/receipt.entity';
// Import separated DTOs
import { CreateInvoiceDto } from '../invoice/dto/create-invoice.dto';
import { CreateReceiptDto } from '../receipt/dto/create-receipt.dto';
import { InvoiceFilterDto } from '../invoice/dto/invoice-filter.dto';
import { ReceiptFilterDto } from '../receipt/dto/receipt-filter.dto';
// Import services for delegation
import { ClassOptionService } from '../class-option/class-option.service';
import { InvoiceService } from '../invoice/invoice.service';
import { ReceiptService } from '../receipt/receipt.service';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,

    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,

    @InjectRepository(ClassOption)
    private readonly classOptionRepo: Repository<ClassOption>,

    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,

    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,

    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepo: Repository<InvoiceItem>,

    @InjectRepository(Receipt)
    private readonly receiptRepo: Repository<Receipt>,

    @InjectRepository(CoursePlus)
    private readonly coursePlusRepo: Repository<CoursePlus>,

    @InjectRepository(DocumentCounter)
    private readonly documentCounterRepo: Repository<DocumentCounter>,

    private readonly dataSource: DataSource,

    // Service injections for delegation
    private readonly classOptionService: ClassOptionService,
    private readonly invoiceService: InvoiceService,
    private readonly receiptService: ReceiptService,
  ) {}

  async generateDocumentId(): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const yearMonthDay = dateStr.replace(/-/g, ''); // YYYYMMDD format

      // Try to find existing counter for today
      let counter = await manager.getRepository(DocumentCounter).findOne({
        where: { date: dateStr },
      });

      if (!counter) {
        // Create new counter for today
        counter = manager.getRepository(DocumentCounter).create({
          date: dateStr,
          counter: 1,
        });
      } else {
        // Increment existing counter
        counter.counter += 1;
      }

      // Save the updated counter
      await manager.getRepository(DocumentCounter).save(counter);

      // Generate document ID: YYYYMMDDXXXX (where XXXX is 4-digit counter)
      const documentId = `${yearMonthDay}${counter.counter.toString().padStart(4, '0')}`;

      return documentId;
    });
  }

  async getNextDocumentId(): Promise<string> {
    // Preview next document ID without incrementing counter
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const yearMonthDay = dateStr.replace(/-/g, ''); // YYYYMMDD format

    const counter = await this.documentCounterRepo.findOne({
      where: { date: dateStr },
    });

    const nextCounter = counter ? counter.counter + 1 : 1;
    return `${yearMonthDay}${nextCounter.toString().padStart(4, '0')}`;
  }

  async create(dto: CreateSessionDto) {
    // Check for existing session with same studentId, courseId, and classOptionId
    console.log('Creating session with data:', dto);

    const session = this.sessionRepository.create(dto);
    session.createdAt = new Date();
    session.invoiceDone = false;
    session.packageGroupId = dto.classOptionId === 11 ? Math.floor(Math.random() * 1000000) : null; 

    return await this.sessionRepository.save(session);
  }

  async createPackage(dto: CreatePackageDto): Promise<{ success: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Find course by name
      const course = await this.courseRepo.findOne({
        where: { title: ILike(`%${dto.courseName}%`) }
      });
      
      if (!course) {
        throw new BadRequestException(`Course with name "${dto.courseName}" not found`);
      }

      // 2. Find class option by class mode
      const classOption = await this.classOptionRepo.findOne({
        where: { classMode: ILike(`%${dto.classOption}%`) }
      });
      
      if (!classOption) {
        throw new BadRequestException(`Class option "${dto.classOption}" not found`);
      }

      // 3. Create the main package session
      const packageSession = manager.getRepository(Session).create({
        studentId: dto.studentId,
        courseId: course.id,
        classOptionId: classOption.id,
        classCancel: 0,
        payment: 'unpaid',
        status: 'wip',
        teacherId: null,
        invoiceDone: false,
        createdAt: new Date(),
        packageGroupId: null // Will be set after saving
      });

      const savedPackageSession = await manager.getRepository(Session).save(packageSession);

      // 4. Set the packageGroupId to its own ID for the package session
      await manager.getRepository(Session).update(savedPackageSession.id, {
        packageGroupId: savedPackageSession.id
      });

      // 5. Determine package size and create TBC sessions
      let packageSize = 0;
      if (dto.courseName.toLowerCase().includes('2 courses')) {
        packageSize = 2;
      } else if (dto.courseName.toLowerCase().includes('4 courses')) {
        packageSize = 4;
      } else if (dto.courseName.toLowerCase().includes('10 courses')) {
        packageSize = 10;
      }

      if (packageSize > 0) {
        // 6. Find TBC course
        const tbcCourse = await this.courseRepo.findOne({
          where: { title: ILike('%TBC%') }
        });
        
        if (!tbcCourse) {
          throw new BadRequestException('TBC course not found');
        }

        // 7. Create TBC sessions linked to the package
        const tbcSessions = [];
        for (let i = 0; i < packageSize; i++) {
          const tbcSession = manager.getRepository(Session).create({
            studentId: dto.studentId,
            courseId: tbcCourse.id,
            classOptionId: classOption.id, // Same class option as package
            classCancel: 0,
            payment: 'unpaid',
            status: 'wip',
            teacherId: null,
            invoiceDone: false,
            createdAt: new Date(),
            packageGroupId: savedPackageSession.id // Link to package session
          });
          tbcSessions.push(tbcSession);
        }

        await manager.getRepository(Session).save(tbcSessions);
      }

      return { success: true };
    });
  }

  async findAll() {
    return this.sessionRepository.find({
      relations: ['course'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    return this.sessionRepository.findOne({
      where: { id },
      relations: ['course', 'classOption'],
    });
  }

  async update(id: number, dto: UpdateSessionDto) {
    return this.dataSource.transaction(async (manager) => {
      // Check if the session being updated is a package session
      const session = await manager.getRepository(Session).findOne({
        where: { id }
      });

      if (!session) {
        throw new BadRequestException(`Session with ID ${id} not found`);
      }

      // Update the main session
      const result = await manager.getRepository(Session).update(id, dto);
      if (result.affected === 0) {
        throw new BadRequestException(`Session with ID ${id} not found`);
      }

      // If this is a package session (packageGroupId equals its own ID), 
      // update related TBC sessions as well
      if (session.packageGroupId === session.id) {
        // Update all TBC sessions linked to this package
        await manager.getRepository(Session).update(
          { packageGroupId: session.id, id: Not(session.id) }, // Not the package session itself
          dto
        );
      }

      return this.findOne(id);
    });
  }

  async cancelSession(id: number) {
    return this.dataSource.transaction(async (manager) => {
      // Check if session exists
      const session = await manager.getRepository(Session).findOne({
        where: { id },
      });

      if (!session) {
        return null;
      }

      // Update session status to 'cancelled'
      await manager.getRepository(Session).update(id, {
        status: 'cancelled',
      });

      // Update all non-completed schedules to 'cancelled'
      // Non-completed means attendance is not 'present' (already attended)
      const updateResult = await manager
        .getRepository(Schedule)
        .createQueryBuilder()
        .update(Schedule)
        .set({ attendance: 'cancelled' })
        .where('sessionId = :sessionId', { sessionId: id })
        .andWhere('attendance != :completedStatus', {
          completedStatus: 'completed',
        })
        .execute();

      return {
        success: true,
        message: 'Session has been successfully cancelled',
        updatedSchedules: updateResult.affected || 0,
      };
    });
  }

  async remove(id: number) {
    const session = await this.findOne(id);
    if (!session) {
      return null;
    }
    await this.sessionRepository.remove(session);
    return session;
  }

  async addCoursePlus(addCoursePlusDto: AddCoursePlusDto) {
    const { sessionId, additionalClasses } = addCoursePlusDto;

    // Verify session exists and get related data
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['course', 'classOption', 'student', 'teacher'],
    });

    if (!session) {
      throw new BadRequestException(`Session with ID ${sessionId} not found`);
    }

    // Calculate amount based on class option
    const pricePerClass =
      session.classOption.tuitionFee / session.classOption.classLimit;
    const totalAmount = pricePerClass * additionalClasses;

    // Create course plus record
    const coursePlus = this.coursePlusRepo.create({
      sessionId: sessionId,
      classNo: additionalClasses,
      amount: totalAmount,
      status: 'unpaid',
      description: `Additional ${additionalClasses} classes for ${session.course.title}`,
      invoiceGenerated: false,
    });

    const savedCoursePlus = await this.coursePlusRepo.save(coursePlus);

    // Create additional schedules based on additionalClasses count
    const createdSchedules = [];
    for (let i = 0; i < additionalClasses; i++) {
      const schedule = this.scheduleRepo.create({
        sessionId: sessionId,
        courseId: session.courseId,
        studentId: session.studentId,
        teacherId: session.teacherId,
        coursePlusId: savedCoursePlus.id,
        startTime: 'TBD', // Placeholder time
        endTime: 'TBD', // Placeholder time
        room: 'TBD', // To be determined
        attendance: '',
        remark: '',
        warning: '',
        feedback: '',
        verifyFb: false,
        classNumber: null,
      });

      const savedSchedule = await this.scheduleRepo.save(schedule);
      createdSchedules.push(savedSchedule);
    }

    return {
      success: true,
      coursePlus: savedCoursePlus,
      schedules: createdSchedules,
      message: `Successfully added ${additionalClasses} additional classes with schedules`,
    };
  }

  async getStudentSessions(studentId: number) {
    const queryBuilder = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.course', 'course')
      .leftJoinAndSelect('session.teacher', 'teacher')
      .leftJoinAndSelect('session.classOption', 'classOption')
      .leftJoinAndSelect('session.student', 'student')
      .where('session.studentId = :studentId', { studentId })
      .andWhere('(session.packageGroupId IS NULL OR session.packageGroupId != session.id)'); // Exclude package sessions

    // Add subqueries to count completed schedules and total schedules
    queryBuilder
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)')
          .from('schedules', 'schedule')
          .where('schedule.sessionId = session.id')
          .andWhere('schedule.attendance = :attendance', {
            attendance: 'completed',
          });
      }, 'completedCount')
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)')
          .from('schedules', 'schedule')
          .where('schedule.sessionId = session.id');
      }, 'totalScheduledCount')
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)')
          .from('schedules', 'schedule')
          .where('schedule.sessionId = session.id')
          .andWhere('schedule.attendance = :canceledAttendance', {
            canceledAttendance: 'cancelled',
          });
      }, 'canceledCount');

    queryBuilder.orderBy('session.createdAt', 'DESC');

    // Get raw and entities to access both the relations and the computed counts
    const result = await queryBuilder.getRawAndEntities();

    // Map the results to include the counts
    return result.entities.map((session, index) => ({
      ...session,
      completedCount: parseInt(result.raw[index].completedCount || '0'),
      totalScheduledCount: parseInt(result.raw[index].totalScheduledCount || '0'),
      canceledCount: parseInt(result.raw[index].canceledCount || '0'),
    }));
  }

  async getStudentSessionByCourse(studentId: number, courseId: number) {
    return this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.course', 'course')
      .leftJoinAndSelect('session.teacher', 'teacher')
      .leftJoinAndSelect('session.classOption', 'classOption')
      .where('session.studentId = :studentId', { studentId })
      .andWhere('session.courseId = :courseId', { courseId })
      .andWhere('(session.packageGroupId IS NULL OR session.packageGroupId != session.id)') // Exclude package sessions
      .getOne();
  }

  async checkStudentHasWipSession(
    studentId: number,
    courseId: number,
  ): Promise<boolean> {
    const session = await this.sessionRepository
      .createQueryBuilder('session')
      .where('session.studentId = :studentId', { studentId })
      .andWhere('session.courseId = :courseId', { courseId })
      .andWhere('session.status = :status', { status: 'wip' })
      .andWhere('(session.packageGroupId IS NULL OR session.packageGroupId != session.id)') // Exclude package sessions
      .getOne();

    return !!session;
  }

  async getSessionOverviewByStudentId(studentId: number) {
    // Optimized query: Join with schedules and use subquery to avoid N+1
    const result = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.course', 'course')
      .leftJoinAndSelect('session.classOption', 'classOption')
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)')
          .from('schedules', 'schedule')
          .where('schedule.sessionId = session.id')
          .andWhere('schedule.attendance = :attendance', {
            attendance: 'present',
          });
      }, 'completedCount')
      .where('session.studentId = :studentId', { studentId })
      .andWhere('(session.packageGroupId IS NULL OR session.packageGroupId != session.id)') // Exclude package sessions
      .getRawAndEntities();

    // Transform the result to match the expected format
    return result.entities.map((session, index) => ({
      sessionId: session.id,
      courseTitle: session.course?.title,
      courseDescription: session.course?.description,
      mode: session.classOption.classMode,
      payment: session.payment,
      completedCount: parseInt(result.raw[index].completedCount || '0'),
      classCancel: session.classCancel,
      medium: session.course.medium,
      comment: session.comment,
    }));
  }

  async getStudentSessionsFiltered(
    studentId: number,
    filterDto: StudentSessionFilterDto,
  ) {
    const { courseName, status, payment, page = 1, limit = 12 } = filterDto;

    // Validate pagination parameters
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100); // Max 100 items per page

    // Build the query
    const queryBuilder = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.course', 'course')
      .leftJoinAndSelect('session.classOption', 'classOption')
      .where('session.studentId = :studentId', { studentId })
      .andWhere('(session.packageGroupId IS NULL OR session.packageGroupId != session.id)'); // Exclude package sessions

    // Apply filters
    if (courseName) {
      queryBuilder.andWhere('course.title ILIKE :courseName', {
        courseName: `%${courseName}%`,
      });
    }

    if (status) {
      if (status === 'completed') {
        queryBuilder.andWhere('session.status = :status', {
          status: 'completed',
        });
      } else if (status === 'wip') {
        queryBuilder.andWhere('session.status = :status', {
          status: 'wip',
        });
      } else if (status === 'cancelled') {
        queryBuilder.andWhere('session.status = :status', {
          status: 'cancelled',
        });
      }
    }

    if (payment) {
      if (payment === 'paid') {
        queryBuilder.andWhere('session.payment = :payment', {
          payment: 'Paid',
        });
      } else if (payment === 'unpaid') {
        queryBuilder.andWhere('session.payment = :payment', {
          payment: 'Unpaid',
        });
      }
    }

    // Get total count for pagination
    const totalCount = await queryBuilder.getCount();

    // Apply pagination
    const offset = (validatedPage - 1) * validatedLimit;
    queryBuilder.skip(offset).take(validatedLimit);

    // Order by creation date (newest first)
    queryBuilder.orderBy('session.createdAt', 'DESC');

    // Optimize: Add subqueries to get progress data in one query instead of N+1
    queryBuilder
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)')
          .from('schedules', 'schedule')
          .where('schedule.sessionId = session.id')
          .andWhere('schedule.attendance = :attendance', {
            attendance: 'completed',
          });
      }, 'completedCount')
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)')
          .from('schedules', 'schedule')
          .where('schedule.sessionId = session.id');
      }, 'totalScheduledCount')
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)')
          .from('schedules', 'schedule')
          .where('schedule.sessionId = session.id')
          .andWhere('schedule.attendance = :canceledAttendance', {
            canceledAttendance: 'cancelled',
          });
      }, 'canceledCount');

    // Get the sessions with progress data in one query
    const result = await queryBuilder.getRawAndEntities();

    // Transform the result to match the expected format
    const transformedResult = result.entities.map((session, index) => {
      const completedCount = parseInt(result.raw[index].completedCount || '0');
      const totalScheduledCount = parseInt(
        result.raw[index].totalScheduledCount || '0',
      );
      const canceledCount = parseInt(result.raw[index].canceledCount || '0');

      // Calculate progress percentage
      const progressPercentage =
        totalScheduledCount > 0
          ? Math.round((completedCount / totalScheduledCount) * 100)
          : 0;

      return {
        sessionId: session.id,
        courseTitle: session.course?.title,
        courseDescription: session.course?.description,
        mode: session.classOption.classMode,
        payment: session.payment,
        completedCount,
        classCancel: canceledCount,
        progress: `${progressPercentage}%`,
        medium: session.course.medium,
        status: session.status,
        comment: session.comment,
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedLimit);
    const hasNext = validatedPage < totalPages;
    const hasPrev = validatedPage > 1;

    return {
      sessions: transformedResult,
      pagination: {
        currentPage: validatedPage,
        totalPages,
        totalCount,
        hasNext,
        hasPrev,
      },
    };
  }

  async getTeacherSessionsFiltered(
    teacherId: number,
    filterDto: TeacherSessionFilterDto,
  ) {
    const { courseName, status, page = 1, limit = 12 } = filterDto;

    // Validate pagination parameters
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100); // Max 100 items per page

    // Build the query
    const queryBuilder = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.course', 'course')
      .leftJoinAndSelect('session.classOption', 'classOption')
      .where('session.teacherId = :teacherId', { teacherId });

    // Apply filters
    if (courseName) {
      queryBuilder.andWhere('course.title ILIKE :courseName', {
        courseName: `%${courseName}%`,
      });
    }

    if (status) {
      if (status === 'completed') {
        queryBuilder.andWhere('session.status = :status', {
          status: 'completed',
        });
      } else if (status === 'wip') {
        queryBuilder.andWhere('session.status = :status', { status: 'wip' });
      }
    }

    // Get total count for pagination
    const totalCount = await queryBuilder.getCount();

    // Apply pagination
    const offset = (validatedPage - 1) * validatedLimit;
    queryBuilder.skip(offset).take(validatedLimit);

    // Order by creation date (newest first)
    queryBuilder.orderBy('session.createdAt', 'DESC');

    // Optimize: Add subqueries to get progress data in one query instead of N+1
    queryBuilder
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)')
          .from('schedules', 'schedule')
          .where('schedule.sessionId = session.id')
          .andWhere('schedule.attendance = :attendance', {
            attendance: 'completed',
          });
      }, 'completedCount')
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)')
          .from('schedules', 'schedule')
          .where('schedule.sessionId = session.id');
      }, 'totalScheduledCount')
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)')
          .from('schedules', 'schedule')
          .where('schedule.sessionId = session.id')
          .andWhere('schedule.attendance = :canceledAttendance', {
            canceledAttendance: 'cancelled',
          });
      }, 'canceledCount');

    // Get the sessions with progress data in one query
    const result = await queryBuilder.getRawAndEntities();

    // Transform the result to match the expected format
    const transformedResult = result.entities.map((session, index) => {
      const completedCount = parseInt(result.raw[index].completedCount || '0');
      const totalScheduledCount = parseInt(
        result.raw[index].totalScheduledCount || '0',
      );
      const canceledCount = parseInt(result.raw[index].canceledCount || '0');

      // Calculate progress percentage
      const progressPercentage =
        totalScheduledCount > 0
          ? Math.round((completedCount / totalScheduledCount) * 100)
          : 0;

      return {
        sessionId: session.id,
        courseTitle: session.course?.title,
        courseDescription: session.course?.description,
        mode: session.classOption.classMode,
        payment: session.payment,
        completedCount,
        classCancel: canceledCount,
        progress: `${progressPercentage}%`,
        medium: session.course.medium,
        status: session.status,
        comment: session.comment,
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedLimit);
    const hasNext = validatedPage < totalPages;
    const hasPrev = validatedPage > 1;

    return {
      sessions: transformedResult,
      pagination: {
        currentPage: validatedPage,
        totalPages,
        totalCount,
        hasNext,
        hasPrev,
      },
    };
  }

  async getPendingSessionsForInvoice(
    startDate?: string,
    endDate?: string,
    status?: string,
    course?: string,
    teacher?: string,
    student?: string,
    transactionType?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    enrollments: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    // Validate pagination parameters
    page = Math.max(1, page);
    limit = Math.min(Math.max(1, limit), 100); // Max 100 items per page

    // Helper function to apply filters
    const applySessionFilters = (qb: any, useSessionAlias = true) => {
      const sessionAlias = useSessionAlias ? 'session' : 'coursePlus';

      // Apply date range filters
      if (startDate) {
        qb.andWhere(`DATE(${sessionAlias}.createdAt) >= :startDate`, {
          startDate: startDate,
        });
      }
      if (endDate) {
        qb.andWhere(`DATE(${sessionAlias}.createdAt) <= :endDate`, {
          endDate: endDate,
        });
      }
      if (course) {
        qb.andWhere('course.title ILIKE :sessionCourse', {
          sessionCourse: `%${course}%`,
        });
      }
      if (teacher) {
        qb.andWhere('teacher.name ILIKE :sessionTeacher', {
          sessionTeacher: `%${teacher}%`,
        });
      }
      if (student) {
        qb.andWhere('student.name ILIKE :sessionStudent', {
          sessionStudent: `%${student}%`,
        });
      }
      return qb;
    };

    // Get all data in parallel to reduce database round trips
    const promises = [];

    // Sessions
    if (
      !transactionType ||
      transactionType === 'all' ||
      transactionType === 'course'
    ) {
      const sessionCountQuery = this.sessionRepository
        .createQueryBuilder('session')
        .leftJoin('session.student', 'student')
        .leftJoin('session.course', 'course')
        .leftJoin('session.teacher', 'teacher')
        .where('session.invoiceDone = :invoiceDone', { invoiceDone: false })
        .andWhere('(session.packageGroupId IS NULL OR session.packageGroupId = session.id)') // Exclude TBC sessions

      applySessionFilters(sessionCountQuery);

      const sessionDataQuery = this.sessionRepository
        .createQueryBuilder('session')
        .leftJoin('session.student', 'student')
        .leftJoin('session.course', 'course')
        .leftJoin('session.teacher', 'teacher')
        .leftJoin('session.classOption', 'classOption')
        .select([
          'session.id as session_id',
          'session.createdAt as session_createdAt',
          'session.status as session_status',
          'session.payment as session_payment',
          'session.invoiceDone as session_invoiceDone',
          'student.id as student_id',
          'student.name as student_name',
          'course.id as course_id',
          'course.title as course_title',
          'teacher.id as teacher_id',
          'teacher.name as teacher_name',
          'classOption.tuitionFee as classOption_tuitionFee',
        ])
        .where('session.invoiceDone = :invoiceDone', { invoiceDone: false })
        .andWhere('(session.packageGroupId IS NULL OR session.packageGroupId = session.id)') // Exclude TBC sessions
        .orderBy('session.createdAt', 'DESC');

      applySessionFilters(sessionDataQuery);

      promises.push(sessionCountQuery.getCount());
      promises.push(sessionDataQuery.getRawMany());
    } else {
      promises.push(Promise.resolve(0));
      promises.push(Promise.resolve([]));
    }

    // Course Plus
    if (
      !transactionType ||
      transactionType === 'all' ||
      transactionType === 'courseplus'
    ) {
      const coursePlusCountQuery = this.coursePlusRepo
        .createQueryBuilder('coursePlus')
        .leftJoin('coursePlus.session', 'session')
        .leftJoin('session.student', 'student')
        .leftJoin('session.course', 'course')
        .leftJoin('session.teacher', 'teacher')
        .where('coursePlus.invoiceGenerated = :cpInvoiceGenerated', {
          cpInvoiceGenerated: false,
        });

      applySessionFilters(coursePlusCountQuery, false);

      const coursePlusDataQuery = this.coursePlusRepo
        .createQueryBuilder('coursePlus')
        .leftJoinAndSelect('coursePlus.session', 'session')
        .leftJoinAndSelect('session.student', 'student')
        .leftJoinAndSelect('session.course', 'course')
        .leftJoinAndSelect('session.classOption', 'classOption')
        .leftJoinAndSelect('session.teacher', 'teacher')
        .where('coursePlus.invoiceGenerated = :cpInvoiceGenerated2', {
          cpInvoiceGenerated2: false,
        })
        .orderBy('coursePlus.createdAt', 'DESC');

      applySessionFilters(coursePlusDataQuery, false);

      promises.push(coursePlusCountQuery.getCount());
      promises.push(coursePlusDataQuery.getMany());
    } else {
      promises.push(Promise.resolve(0));
      promises.push(Promise.resolve([]));
    }

    // Execute all queries in parallel
    const [sessionCount, sessionData, coursePlusCount, coursePlusData] =
      await Promise.all(promises);

    // Calculate total count and pagination
    const totalCountWithExtras = sessionCount + coursePlusCount;
    const totalPages = Math.ceil(totalCountWithExtras / limit);

    // Combine all data and sort by creation date
    let allEnrollments = [];

    // Add session enrollments
    if (sessionData.length > 0) {
      allEnrollments.push(...sessionData);
    }

    // Transform and add course plus enrollments
    if (coursePlusData.length > 0) {
      const coursePlusAsEnrollments = coursePlusData.map((coursePlus) => ({
        session_id: `cp-${coursePlus.id}`,
        session_createdAt: coursePlus.createdAt,
        session_status: coursePlus.session.status,
        session_payment: coursePlus.session.payment,
        session_invoiceDone: false,
        student_id: coursePlus.session.student.id,
        student_name: coursePlus.session.student.name,
        course_id: coursePlus.session.course.id,
        course_title: `${coursePlus.session.course.title} (Course Plus)`,
        teacher_id: coursePlus.session.teacher?.id,
        teacher_name: coursePlus.session.teacher?.name,
        classOption_tuitionFee: coursePlus.amount,
        // Additional fields
        coursePlusId: coursePlus.id,
        type: 'course_plus',
        additionalClasses: coursePlus.classNo,
        description: coursePlus.description,
      }));
      allEnrollments.push(...coursePlusAsEnrollments);
    }

    // Sort all enrollments by creation date (newest first)
    allEnrollments.sort((a, b) => {
      const dateA = new Date(a.session_createdAt || a.session_createdat);
      const dateB = new Date(b.session_createdAt || b.session_createdat);
      return dateB.getTime() - dateA.getTime();
    });

    // Apply pagination to the combined results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEnrollments = allEnrollments.slice(startIndex, endIndex);

    // Normalize field names to match expected format
    const normalizedEnrollments = paginatedEnrollments.map((enrollment) => ({
      ...enrollment,
      session_createdat:
        enrollment.session_createdAt || enrollment.session_createdat,
      classoption_tuitionfee:
        enrollment.classOption_tuitionFee || enrollment.classoption_tuitionfee,
    }));

    console.log(
      `Returning ${normalizedEnrollments.length} enrollments out of ${totalCountWithExtras} total`,
    );

    return {
      enrollments: normalizedEnrollments,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: totalCountWithExtras,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getSpecificPendingSessionsForInvoice(sessionId: number | string) {
    console.log(
      'Fetching specific pending session for invoice with ID:',
      sessionId,
    );

    // Check if this is a Course Plus ID (prefixed with 'cp-')
    if (typeof sessionId === 'string' && sessionId.startsWith('cp-')) {
      const coursePlusId = parseInt(sessionId.replace('cp-', ''));
      console.log('Fetching Course Plus record with ID:', coursePlusId);

      const coursePlus = await this.coursePlusRepo.findOne({
        where: { id: coursePlusId },
        relations: [
          'session',
          'session.student',
          'session.course',
          'session.classOption',
        ],
      });

      if (!coursePlus) {
        console.log('Course Plus record not found with ID:', coursePlusId);
        return null;
      }

      // Transform Course Plus to match the expected session format
      const transformedCoursePlus = {
        session_id: coursePlusId,
        session_createdat: coursePlus.session.createdAt,
        student_id: coursePlus.session.student.id,
        student_name: coursePlus.session.student.name,
        course_title: `${coursePlus.session.course.title} (Course Plus)`,
        classoption_tuitionfee: coursePlus.amount, // Use Course Plus amount instead of class option fee
        // Additional Course Plus specific fields
        type: 'course_plus',
        coursePlusId: coursePlus.id,
        additionalClasses: coursePlus.classNo,
        description: coursePlus.description,
        originalSessionId: coursePlus.sessionId,
      };

      console.log(
        'Fetched specific Course Plus for invoice:',
        transformedCoursePlus,
      );
      return transformedCoursePlus;
    }

    // Handle regular session (original logic)
    const session = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoin('session.student', 'student')
      .leftJoin('session.course', 'course')
      .leftJoin('session.classOption', 'classOption')
      .select([
        'session.id',
        'session.createdAt',
        'student.id',
        'student.name',
        'course.title',
        'classOption.tuitionFee as classoption_tuitionfee',
      ])
      .andWhere('session.id = :sessionId', { sessionId })
      .getRawOne();

    if (session) {
      session.type = 'session'; // Add type for consistency
    }
    return session;
  }

  async getInvoice(id: number) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    return invoice;
  }
  async getReceipt(id: number) {
    return this.receiptRepo.findOne({
      where: { id },
      relations: [
        'invoice',
        'invoice.items',
        'invoice.session',
        'invoice.session.student',
        'invoice.session.course',
      ],
    });
  }

  async listInvoices(
    page: number = 1,
    limit: number = 10,
    documentId?: string,
    student?: string,
    course?: string,
    receiptDone?: string,
  ): Promise<{
    invoices: Invoice[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const offset = (page - 1) * limit;

    const queryBuilder = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'items')
      .orderBy('invoice.date', 'DESC');

    if (documentId) {
      queryBuilder.andWhere('invoice.documentId ILIKE :documentId', {
        documentId: `%${documentId}%`,
      });
    }

    if (student) {
      queryBuilder.andWhere('invoice.studentName ILIKE :studentName', {
        studentName: `%${student}%`,
      });
    }

    if (course) {
      queryBuilder.andWhere('invoice.courseName ILIKE :courseName', {
        courseName: `%${course}%`,
      });
    }

    if (receiptDone == 'completed') {
      queryBuilder.andWhere('invoice.receiptDone = :receiptDone', {
        receiptDone: true,
      });
    } else if (receiptDone == 'pending') {
      queryBuilder.andWhere('invoice.receiptDone = :receiptDone', {
        receiptDone: false,
      });
    }

    // Get total count
    const totalCount = await queryBuilder.getCount();

    // Get paginated data
    const invoices = await queryBuilder.offset(offset).limit(limit).getMany();

    const totalPages = Math.ceil(totalCount / limit);
    return {
      invoices,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async listReceipts(filter: ReceiptFilterDto) {
    const {
      page = 1,
      limit = 10,
      from,
      to,
      invoiceId,
      sessionId,
      studentId,
      courseId,
      receiptNumber,
    } = filter;

    const qb = this.receiptRepo
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.invoice', 'invoice')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('invoice.session', 'session')
      .leftJoinAndSelect('session.student', 'student')
      .leftJoinAndSelect('session.course', 'course')
      .orderBy('receipt.date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (from) qb.andWhere('receipt.date >= :from', { from });
    if (to) qb.andWhere('receipt.date <= :to', { to });
    if (invoiceId) qb.andWhere('receipt.invoiceId = :invoiceId', { invoiceId });
    if (sessionId) qb.andWhere('invoice.sessionId = :sessionId', { sessionId });
    if (studentId) qb.andWhere('student.id = :studentId', { studentId });
    if (courseId) qb.andWhere('course.id = :courseId', { courseId });
    if (receiptNumber)
      qb.andWhere('receipt.receiptNumber = :receiptNumber', { receiptNumber });
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async createClassOption(dto: {
    classMode: string;
    classLimit: number;
    tuitionFee: number;
  }) {
    const current = await this.classOptionRepo.findOne({
      where: { classMode: dto.classMode, effectiveEndDate: null },
    });
    if (current) {
      current.effectiveEndDate = new Date();
      await this.classOptionRepo.save(current);
    }
    const newOption = this.classOptionRepo.create({
      ...dto,
      effectiveStartDate: new Date(),
      effectiveEndDate: null,
    });
    return this.classOptionRepo.save(newOption);
  }

  async listClassOptions() {
    return this.classOptionRepo.find();
  }

  async createInvoiceAndMarkSession(dto: CreateInvoiceDto) {
    return this.dataSource.transaction(async (manager) => {
      // Generate document ID if not provided
      const documentId = await this.generateDocumentId();

      // Create the invoice with session groups stored
      const invoiceRepo = manager.getRepository(Invoice);
      const invoice = invoiceRepo.create({
        studentId: dto.studentId,
        studentName: dto.studentName,
        courseName: dto.courseName,
        documentId: documentId,
        date: new Date(dto.date),
        paymentMethod: dto.paymentMethod,
        totalAmount: dto.totalAmount,
        sessionGroups: dto.sessionGroups, // Store session groups for later reference
        items: dto.items.map((item) =>
          manager.getRepository(InvoiceItem).create(item),
        ),
      });
      const savedInvoice = await invoiceRepo.save(invoice);

      // Update the status of all related entities based on sessionGroups
      for (const sessionGroup of dto.sessionGroups) {
        const { transactionType, actualId } = sessionGroup;

        if (transactionType === 'course') {
          const sessionRepo = manager.getRepository(Session);
          await sessionRepo.update(parseInt(actualId), { invoiceDone: true });
        } else if (transactionType === 'courseplus') {
          const coursePlusRepo = manager.getRepository(CoursePlus);
          // Remove 'cp-' prefix if it exists
          const coursePlusId = actualId.startsWith('cp-')
            ? parseInt(actualId.replace('cp-', ''))
            : parseInt(actualId);
          await coursePlusRepo.update(coursePlusId, {
            invoiceGenerated: true,
          });
        }
      }

      return savedInvoice;
    });
  }

  // Keep legacy method for backward compatibility
  // async createInvoiceAndMarkSessionLegacy(dto: CreateInvoiceLegacyDto) {
  //   return this.dataSource.transaction(async (manager) => {
  //     // Validate that the correct ID is provided based on type
  //     if (dto.transactionType === 'course' && !dto.sessionId) {
  //       throw new BadRequestException('sessionId is required for course type');
  //     }
  //     if (dto.transactionType === 'courseplus' && !dto.coursePlusId) {
  //       throw new BadRequestException(
  //         'coursePlusId is required for courseplus type',
  //       );
  //     }
  //     if (dto.transactionType === 'package' && !dto.packageId) {
  //       throw new BadRequestException('packageId is required for package type');
  //     }

  //     const invoiceRepo = manager.getRepository(Invoice);
  //     const invoice = invoiceRepo.create({
  //       studentId: dto.studentId,
  //       studentName: dto.studentName,
  //       courseName: dto.courseName,
  //       documentId: dto.documentId,
  //       date: new Date(dto.date),
  //       paymentMethod: dto.paymentMethod,
  //       totalAmount: dto.totalAmount,
  //       items: dto.items.map((item) =>
  //         manager.getRepository(InvoiceItem).create(item),
  //       ),
  //     });
  //     const savedInvoice = await invoiceRepo.save(invoice);

  //     // Update the respective entity based on type
  //     if (dto.transactionType === 'course' && dto.sessionId) {
  //       const sessionRepo = manager.getRepository(Session);
  //       await sessionRepo.update(dto.sessionId, { invoiceDone: true });
  //     } else if (dto.transactionType === 'courseplus' && dto.coursePlusId) {
  //       const coursePlusRepo = manager.getRepository(CoursePlus);
  //       const coursePlusId = parseInt(
  //         (dto.coursePlusId as string).replace('cp-', ''),
  //       );
  //       await coursePlusRepo.update(coursePlusId, {
  //         invoiceGenerated: true,
  //       });
  //     } else if (dto.transactionType === 'package' && dto.packageId) {
  //       const packageId = parseInt(
  //         (dto.packageId as string).replace('pkg-', ''),
  //       );
  //       const packageRepo = manager.getRepository(PackageEntity);
  //       await packageRepo.update(packageId, { invoiceGenerated: true });
  //     }

  //     return savedInvoice;
  //   });
  // }

  async createReceiptAndMarkPaid(dto: CreateReceiptDto) {
    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(Receipt);
      const receipt = receiptRepo.create({
        invoiceId: dto.invoiceId,
        date: new Date(dto.date),
      });
      const savedReceipt = await receiptRepo.save(receipt);

      const invoiceRepo = manager.getRepository(Invoice);
      const invoice = await invoiceRepo.findOne({
        where: { id: dto.invoiceId },
      });
      if (!invoice) throw new Error('Invoice not found');

      // Mark the invoice as receipt done
      await invoiceRepo.update(dto.invoiceId, { receiptDone: true });

      // Use stored session groups from the invoice to mark sessions as paid
      if (invoice.sessionGroups && invoice.sessionGroups.length > 0) {
        for (const sessionGroup of invoice.sessionGroups) {
          const { transactionType, actualId } = sessionGroup;

          if (transactionType === 'course') {
            const sessionRepo = manager.getRepository(Session);
            await sessionRepo.update(parseInt(actualId), { payment: 'Paid' });
          } else if (transactionType === 'courseplus') {
            const coursePlusRepo = manager.getRepository(CoursePlus);
            const coursePlusId = actualId.startsWith('cp-')
              ? parseInt(actualId.replace('cp-', ''))
              : parseInt(actualId);
            await coursePlusRepo.update(coursePlusId, { status: 'paid' });
          }
        }
      }

      return savedReceipt;
    });
  }

  async submitFeedback(dto: SubmitFeedbackDto) {
    const { sessionId, studentId, feedback, timestamp, feedbackImages, feedbackVideos } = dto;

    // First, verify that the session exists and belongs to the student
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, studentId },
      relations: ['course', 'student'],
    });

    if (!session) {
      throw new BadRequestException(
        `Session with ID ${sessionId} not found for student ${studentId}`,
      );
    }

    // Prepare the feedback date
    const feedbackDate = timestamp ? new Date(timestamp) : new Date();

    // Prepare update fields
    const updateFields: any = {
      feedback: feedback,
      feedbackDate: feedbackDate,
      verifyFb: false, // Mark feedback as not verified (teacher submitted)
    };

    // Add media arrays if provided (TypeORM simple-array handles comma-separation)
    if (feedbackImages && feedbackImages.length > 0) {
      updateFields.feedbackImages = feedbackImages;
    }
    if (feedbackVideos && feedbackVideos.length > 0) {
      updateFields.feedbackVideos = feedbackVideos;
    }

    // Update feedback for all schedules in this session
    const result = await this.scheduleRepo
      .createQueryBuilder()
      .update(Schedule)
      .set(updateFields)
      .where('sessionId = :sessionId', { sessionId })
      .andWhere('studentId = :studentId', { studentId })
      .execute();

    const updatedSchedules = result.affected || 0;

    if (updatedSchedules === 0) {
      throw new BadRequestException(
        `No schedules found for session ${sessionId} and student ${studentId}`,
      );
    }

    return {
      success: true,
      message: `Feedback successfully submitted for session ${sessionId}`,
      updatedSchedules,
      sessionId,
      studentId,
      courseName: session.course?.title,
      studentName: session.student?.name,
      mediaAttached: {
        images: feedbackImages?.length || 0,
        videos: feedbackVideos?.length || 0,
      },
    };
  }

  // ========== DELEGATION METHODS TO NEW SERVICES ==========
  // These methods delegate to separated services while maintaining backward compatibility

  // ClassOption delegation methods
  async createClassOptionDelegated(dto: any) {
    return this.classOptionService.create(dto);
  }

  async listClassOptionsDelegated() {
    return this.classOptionService.findAll();
  }

  // Invoice delegation methods
  async getInvoiceDelegated(id: number) {
    return this.invoiceService.findOne(id);
  }

  async listInvoicesDelegated(
    page: number,
    limit: number,
    documentId?: string,
    student?: string,
    course?: string,
    receiptDone?: string,
  ) {
    return this.invoiceService.findAll({
      page,
      limit,
      documentId,
      studentId: student ? parseInt(student) : undefined,
      courseName: course,
      receiptDone,
    });
  }

  // Receipt delegation methods
  async getReceiptDelegated(id: number) {
    return this.receiptService.findOne(id);
  }

  async listReceiptsDelegated(filter: any) {
    return this.receiptService.findAll(filter);
  }

  // Generate document ID using InvoiceService
  async getNextDocumentIdDelegated() {
    return this.invoiceService.getNextDocumentId();
  }
}
function andWhere(arg0: string, arg1: { freeTrial: string; }) {
  throw new Error('Function not implemented.');
}

