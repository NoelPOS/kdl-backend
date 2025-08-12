import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { UserEntity } from '../../user/entities/user.entity';
import { StudentEntity } from '../../user/entities/student.entity';
import { TeacherEntity } from '../../user/entities/teacher.entity';
import { ParentEntity } from '../../user/entities/parent.entity';
import { CourseEntity } from '../../course/entities/course.entity';
import {
  Session,
  ClassOption,
  Invoice,
  InvoiceItem,
  Receipt,
} from '../../session/entities/session.entity';
import { Schedule } from '../../schedule/entities/schedule.entity';
// import { CoursePlus } from '../../course-plus/entities/course-plus.entity';
import { RoomEntity } from '../../room/entities/room.entity';
import * as bcrypt from 'bcrypt';
import { DiscountEntity } from '../../discount/entities/discount.entity';

export class DataSeeder {
  constructor(private dataSource: DataSource) {}

  async seed() {
    console.log('🌱 Starting data seeding...');

    // Clear all existing data
    // await this.clearData();

    // Create test data
    const users = await this.createUsers();
    const students = await this.createStudents();
    const teachers = await this.createTeachers();
    const parents = await this.createParents();
    const courses = await this.createCourses();
    const rooms = await this.createRooms();
    const classOptions = await this.createClassOptions();

    // Create teacher-course relationships
    await this.createTeacherCourseRelations(teachers, courses);
    // Create parent-student relationships
    await this.createParentStudentRelations(parents, students);

    const sessions = await this.createSessions(
      students,
      courses,
      classOptions,
      teachers,
    );
    const schedules = await this.createSchedules(
      sessions,
      courses,
      students,
      teachers,
      classOptions,
    );
    const discounts = await this.createDiscounts();
    const invoices = await this.createInvoices(sessions, classOptions);
    const invoiceItems = await this.createInvoiceItems(invoices, discounts);
    const receipts = await this.createReceipts(invoices);
    // const coursePlus = await this.createCoursePlus(sessions);

    console.log('✅ Data seeding completed!');
    console.log(`Created:
    - ${users.length} users
    - ${students.length} students
    - ${teachers.length} teachers
    - ${parents.length} parents
    - ${courses.length} courses
    - ${rooms.length} rooms
    - ${classOptions.length} class options
    - ${sessions.length} sessions
    - ${schedules.length} schedules
    - ${invoices.length} invoices
    - ${invoiceItems.length} invoice items
    - ${receipts.length} receipts
    `);
  }

  private async clearData() {
    console.log('🧹 Clearing existing data...');

    const entities = [
      'receipts',
      'invoice_items',
      'invoices',
      'course_plus',
      'schedules',
      'sessions',
      'class_options',
      'rooms',
      'teacher_course', // Clear this before courses
      'courses',
      'parents',
      'teachers',
      'students',
      'tokens',
      'users',
      'discounts',
    ];

    for (const entity of entities) {
      await this.dataSource.query(`DELETE FROM ${entity}`);
      console.log(`Cleared ${entity}`);
    }
  }

  private async createUsers() {
    console.log('👥 Creating users...');
    const userRepo = this.dataSource.getRepository(UserEntity);
    const users = [];

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash('password123', salt);

    // Add admin user
    const adminUser = new UserEntity();
    adminUser.userName = 'admin';
    adminUser.email = 'admin@test.com';
    adminUser.password = hashedPassword;
    adminUser.role = 'admin';
    adminUser.isVerified = true;
    users.push(adminUser);

    return await userRepo.save(users);
  }

  private async createStudents() {
    console.log('🎓 Creating students...');
    const studentRepo = this.dataSource.getRepository(StudentEntity);
    const students = [];

    for (let i = 0; i < 50; i++) {
      const student = new StudentEntity();
      student.name = faker.person.fullName();
      student.nickname = faker.person.firstName();
      student.dob = faker.date
        .birthdate({ min: 5, max: 18, mode: 'age' })
        .toISOString()
        .split('T')[0];
      student.gender = faker.helpers.arrayElement(['Male', 'Female']);
      student.school = faker.helpers.arrayElement([
        'Bangkok International School',
        'Chulalongkorn University',
        'Kasetsart University',
        'Mahidol University',
        'Thammasat University',
        'King Mongkut University',
        'Assumption College',
        'St. Andrews School',
      ]);
      student.allergic = faker.helpers.arrayElements(
        ['peanuts', 'dairy', 'eggs', 'shellfish', 'none'],
        { min: 0, max: 2 },
      );
      student.doNotEat = faker.helpers.arrayElements(
        ['pork', 'beef', 'seafood', 'spicy food', 'none'],
        { min: 0, max: 2 },
      );
      student.adConcent = faker.datatype.boolean();
      student.phone = faker.phone.number();
      student.profilePicture = faker.image.avatar();
      students.push(student);
    }

    return await studentRepo.save(students);
  }

  private async createTeachers() {
    console.log('👩‍🏫 Creating teachers...');
    const teacherRepo = this.dataSource.getRepository(TeacherEntity);
    const teachers = [];

    for (let i = 0; i < 15; i++) {
      const teacher = new TeacherEntity();
      teacher.name = faker.person.fullName();
      teacher.email = faker.internet.email();
      teacher.contactNo = faker.phone.number();
      teacher.lineId = faker.internet.userName();
      teacher.address = faker.location.streetAddress();
      teacher.profilePicture = faker.image.avatar();
      teachers.push(teacher);
    }

    return await teacherRepo.save(teachers);
  }

  private async createParents() {
    console.log('👨‍👩‍👧‍👦 Creating parents...');
    const parentRepo = this.dataSource.getRepository(ParentEntity);
    const parents = [];

    for (let i = 0; i < 30; i++) {
      const parent = new ParentEntity();
      parent.name = faker.person.fullName();
      parent.email = faker.internet.email();
      parent.contactNo = faker.phone.number();
      parent.lineId = faker.internet.userName();
      parent.address = faker.location.streetAddress();
      parents.push(parent);
    }

    return await parentRepo.save(parents);
  }

  private async createCourses() {
    console.log('📚 Creating courses...');
    const courseRepo = this.dataSource.getRepository(CourseEntity);
    const courses = [];

    const courseData = [
      {
        title: 'Mathematics Basic',
        description: 'Basic mathematics for elementary students',
        ageRange: '5-6',
        medium: 'Tablet',
      },
      {
        title: 'English Conversation',
        description: 'Conversational English for all levels',
        ageRange: '7-8',
        medium: 'Computer',
      },
      {
        title: 'Science Exploration',
        description: 'Basic science concepts and experiments',
        ageRange: '7-8',
        medium: 'Tablet',
      },
      {
        title: 'Art & Creativity',
        description: 'Creative arts and crafts for children',
        ageRange: '5-6',
        medium: 'Tablet',
      },
      {
        title: 'Computer Programming',
        description: 'Introduction to programming concepts',
        ageRange: '9-12',
        medium: 'Computer',
      },
      {
        title: 'Music Theory',
        description: 'Basic music theory and practice',
        ageRange: '9-12',
        medium: 'Tablet',
      },
      {
        title: 'Chinese Language',
        description: 'Mandarin Chinese for beginners',
        ageRange: '13-18',
        medium: 'Tablet',
      },
      {
        title: 'Physics Advanced',
        description: 'Advanced physics concepts',
        ageRange: '13-18',
        medium: 'Computer',
      },
    ];

    for (const data of courseData) {
      const course = new CourseEntity();
      course.title = data.title;
      course.description = data.description;
      course.ageRange = data.ageRange;
      course.medium = data.medium;
      courses.push(course);
    }

    return await courseRepo.save(courses);
  }

  private async createRooms() {
    console.log('🏢 Creating rooms...');
    const roomRepo = this.dataSource.getRepository(RoomEntity);
    const rooms = [];

    const roomNames = ['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5'];

    for (const name of roomNames) {
      const room = new RoomEntity();
      room.name = name;
      rooms.push(room);
    }

    return await roomRepo.save(rooms);
  }

  private async createClassOptions() {
    console.log('⚙️ Creating class options...');
    const classOptionRepo = this.dataSource.getRepository(ClassOption);
    const classOptions = [];

    const optionData = [
      { classMode: '12 times fixed', classLimit: 12, tuitionFee: 14700 },
      { classMode: '12 times check', classLimit: 12, tuitionFee: 14700 },
      { classMode: '5 days camp', classLimit: 5, tuitionFee: 1500 },
      { classMode: '2 days camp', classLimit: 2, tuitionFee: 6000 },
    ];

    for (const data of optionData) {
      const option = new ClassOption();
      option.classMode = data.classMode;
      option.classLimit = data.classLimit;
      option.tuitionFee = data.tuitionFee;
      option.effectiveStartDate = faker.date.past();
      option.effectiveEndDate = faker.date.future();
      classOptions.push(option);
    }

    return await classOptionRepo.save(classOptions);
  }

  private async createSessions(
    students: StudentEntity[],
    courses: CourseEntity[],
    classOptions: ClassOption[],
    teachers: TeacherEntity[],
  ) {
    console.log('📝 Creating sessions...');
    const sessionRepo = this.dataSource.getRepository(Session);
    const sessions = [];

    // Create a mapping of courseId to available teachers for efficiency
    const courseTeacherMap = new Map<number, { id: number }[]>();
    for (const course of courses) {
      const availableTeachers = await this.getTeachersForCourse(course.id);
      courseTeacherMap.set(course.id, availableTeachers);
    }

    for (let i = 0; i < 20; i++) {
      const session = new Session();
      session.studentId = faker.helpers.arrayElement(students).id;
      const selectedCourse = faker.helpers.arrayElement(courses);
      session.courseId = selectedCourse.id;
      session.classOptionId = faker.helpers.arrayElement(classOptions).id;

      // Get teachers who can teach this specific course
      const availableTeachers = courseTeacherMap.get(selectedCourse.id) || [];

      if (availableTeachers.length === 0) {
        console.warn(
          `No teachers available for course ${selectedCourse.title}. Skipping session creation.`,
        );
        continue;
      }

      session.teacherId = faker.helpers.arrayElement(availableTeachers).id;
      session.classCancel = faker.number.int({ min: 0, max: 3 });
      session.payment = faker.helpers.arrayElement(['Paid', 'Unpaid']);
      session.status = faker.helpers.arrayElement(['WP', 'Completed']);
      session.invoiceDone = faker.datatype.boolean();
      sessions.push(session);
    }

    return await sessionRepo.save(sessions);
  }

  private async createSchedules(
    sessions: Session[],
    courses: CourseEntity[],
    students: StudentEntity[],
    teachers: TeacherEntity[],
    classOptions: ClassOption[],
  ) {
    console.log('📅 Creating schedules...');
    const scheduleRepo = this.dataSource.getRepository(Schedule);
    const schedules = [];

    for (const session of sessions) {
      // Find the corresponding class option
      const classOption = classOptions.find(
        (option) => option.id === session.classOptionId,
      );
      if (!classOption) {
        console.warn(`Class option not found for session ${session.id}`);
        continue;
      }

      for (let i = 0; i < classOption.classLimit; i++) {
        const schedule = new Schedule();
        schedule.sessionId = session.id;
        schedule.courseId = session.courseId;
        schedule.studentId = session.studentId;
        schedule.teacherId = session.teacherId;
        schedule.date = faker.date.between({
          from: new Date(),
          to: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        });

        schedule.startTime = faker.helpers.arrayElement([
          '09:00',
          '10:00',
          '11:00',
          '13:00',
          '14:00',
          '15:00',
          '16:00',
        ]);
        schedule.endTime = faker.helpers.arrayElement([
          '10:00',
          '11:00',
          '12:00',
          '14:00',
          '15:00',
          '16:00',
          '17:00',
        ]);
        schedule.room = faker.helpers.arrayElement([
          'Room 1',
          'Room 2',
          'Room 3',
          'Room 4',
          'Room 5',
        ]);
        schedule.attendance = faker.helpers.arrayElement([
          'pending',
          'confirmed',
          'present',
          'cancelled',
          'absent',
        ]);
        schedule.remark = faker.lorem.sentence();
        schedule.warning = faker.datatype.boolean()
          ? faker.lorem.sentence()
          : '';
        schedule.feedback = faker.lorem.paragraph();
        schedule.verifyFb = faker.datatype.boolean();
        schedule.classNumber = i + 1; // Class number starts from 1
        schedules.push(schedule);
      }
    }
    return await scheduleRepo.save(schedules);
  }

  private async createInvoices(
    sessions: Session[],
    classOptions: ClassOption[],
  ) {
    console.log('🧾 Creating invoices...');
    const invoiceRepo = this.dataSource.getRepository(Invoice);
    const invoices = [];

    // Create a shuffled copy of sessions to avoid duplicates
    const sessionIds = sessions.map((s) => s.id);
    const shuffledSessionIds = faker.helpers.shuffle(sessionIds);

    // Create invoices for first 10 sessions (or all sessions if less than 10)
    const invoiceCount = Math.min(10, shuffledSessionIds.length);

    for (let i = 0; i < invoiceCount; i++) {
      const session = sessions.find((s) => s.id === shuffledSessionIds[i]);
      if (!session) continue; // Skip if session not found

      // Find the corresponding class option
      const classOption = classOptions.find(
        (option) => option.id === session.classOptionId,
      );
      if (!classOption) {
        console.warn(`Class option not found for session ${session.id}`);
        continue;
      }

      const invoice = new Invoice();
      invoice.documentId = `INV-${faker.string.alphanumeric(6).toUpperCase()}`;
      invoice.date = faker.date.recent();
      invoice.paymentMethod = faker.helpers.arrayElement([
        'Cash',
        'QR Code',
        'Credit Card',
      ]);
      invoice.totalAmount = classOption.tuitionFee;
      invoice.receiptDone = faker.datatype.boolean();
      invoices.push(invoice);
    }

    return await invoiceRepo.save(invoices);
  }

  private async createDiscounts() {
    console.log('💸 Creating discounts...');
    const discountRepo = this.dataSource.getRepository(DiscountEntity);
    const discounts = [];

    const discountData = [
      {
        title: 'Admission Fee',
        usage: 'One-time fee for new students',
        amount: 2000,
        effective_start_date: faker.date.past({ years: 1 }),
        effective_end_date: null, // No end date
      },
      {
        title: 'Promotional Discount',
        usage: 'Seasonal promotion for all courses',
        amount: 700,
        effective_start_date: faker.date.past({ years: 1 }),
        effective_end_date: faker.date.future({ years: 1 }), // Valid for 1 year
      },
    ];

    for (const data of discountData) {
      const discount = new DiscountEntity();
      discount.title = data.title;
      discount.usage = data.usage;
      discount.amount = data.amount;
      discount.effective_start_date = data.effective_start_date;
      discount.effective_end_date = data.effective_end_date;
      discounts.push(discount);
    }

    return await discountRepo.save(discounts);
  }

  private async createInvoiceItems(
    invoices: Invoice[],
    discounts: DiscountEntity[],
  ) {
    console.log('📄 Creating invoice items...');
    const invoiceItemRepo = this.dataSource.getRepository(InvoiceItem);
    const invoiceItems = [];

    // create invoice from some of the existing sessions
    const invoicesWithItems = faker.helpers.arrayElements(invoices, {
      min: 20,
      max: 30,
    });
    for (const invoice of invoicesWithItems) {
      const invoiceItem = new InvoiceItem();
      invoiceItem.invoiceId = invoice.id;
      invoiceItem.description = faker.lorem.sentence();
      invoiceItem.amount = faker.number.int({
        min: 1000,
        max: 5000,
      });
    }
    return await invoiceItemRepo.save(invoiceItems);
  }

  private async createReceipts(invoices: Invoice[]) {
    console.log('🧾 Creating receipts...');
    const receiptRepo = this.dataSource.getRepository(Receipt);
    const receipts = [];

    // Create receipts for some invoices
    const invoicesWithReceipts = faker.helpers.arrayElements(invoices, {
      min: 30,
      max: 50,
    });

    for (const invoice of invoicesWithReceipts) {
      const receipt = new Receipt();
      receipt.invoiceId = invoice.id;
      receipt.date = faker.date.between({ from: invoice.date, to: new Date() });
      receipts.push(receipt);
    }

    return await receiptRepo.save(receipts);
  }

  private async createTeacherCourseRelations(
    teachers: TeacherEntity[],
    courses: CourseEntity[],
  ) {
    console.log('🔗 Creating teacher-course relationships...');

    // Create random relationships between teachers and courses
    for (const teacher of teachers) {
      // Each teacher can teach 1-3 random courses
      const numCourses = faker.number.int({ min: 1, max: 3 });
      const teacherCourses = faker.helpers.arrayElements(courses, numCourses);

      for (const course of teacherCourses) {
        // Insert directly into the junction table
        await this.dataSource.query(
          'INSERT INTO teacher_course ("teacherId", "courseId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [teacher.id, course.id],
        );
      }
    }

    console.log('✅ Teacher-course relationships created');
  }

  private async createParentStudentRelations(
    parents: ParentEntity[],
    students: StudentEntity[],
  ) {
    console.log('🔗 Creating parent-student relationships...');

    // Create random relationships between parents and students
    for (const parent of parents) {
      // Each parent can have 1-3 children
      const numChildren = faker.number.int({ min: 1, max: 3 });
      const parentChildren = faker.helpers.arrayElements(students, numChildren);

      for (const child of parentChildren) {
        // Insert directly into the junction table
        await this.dataSource.query(
          'INSERT INTO parent_student ("parentId", "studentId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [parent.id, child.id],
        );
      }
    }

    console.log('✅ Parent-student relationships created');
  }

  private async getTeachersForCourse(
    courseId: number,
  ): Promise<{ id: number }[]> {
    const result = await this.dataSource.query(
      `
      SELECT t.* FROM teachers t
      INNER JOIN teacher_course tc ON t.id = tc."teacherId"
      WHERE tc."courseId" = $1
    `,
      [courseId],
    );

    return result;
  }

  //   private async createCoursePlus(sessions: Session[]) {
  //     console.log('📚+ Creating course plus...');
  //     const coursePlusRepo = this.dataSource.getRepository(CoursePlus);
  //     const coursePlus = [];

  //     // Create course plus for some sessions
  //     const sessionsWithPlus = faker.helpers.arrayElements(sessions, {
  //       min: 20,
  //       max: 40,
  //     });

  //     for (const session of sessionsWithPlus) {
  //       const plus = new CoursePlus();
  //       plus.sessionId = session.id;
  //       plus.classNo = faker.number.int({ min: 1, max: 20 });
  //       plus.amount = faker.number.int({ min: 200, max: 1000 });
  //       plus.payment = faker.datatype.boolean();
  //       plus.description = faker.lorem.sentence();
  //       coursePlus.push(plus);
  //     }

  //     return await coursePlusRepo.save(coursePlus);
  //   }
}
