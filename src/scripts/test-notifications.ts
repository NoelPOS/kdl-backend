/**
 * Test Notification Script
 * 
 * Quick script to test the notification system
 * Run with: npm run test-notification
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app/app.module';
import { ScheduleNotificationService } from '../line/services/schedule-notification.service';
import { NotificationService } from '../notification/notification.service';
import { DataSource } from 'typeorm';

async function bootstrap() {
  console.log('🚀 Starting notification test...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const scheduleNotificationService = app.get(ScheduleNotificationService);
  const notificationService = app.get(NotificationService);
  const dataSource = app.get(DataSource);

  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'test':
        await testSingleNotification(scheduleNotificationService, dataSource, args);
        break;
      case 'cron':
        await testCronJob(scheduleNotificationService, dataSource);
        break;
      case 'list':
        await listEligibleSchedules(dataSource);
        break;
      case 'create':
        await createTestSchedule(dataSource, args);
        break;
      case 'seed':
        await seedInAppNotifications(notificationService, dataSource, args);
        break;
      default:
        printHelp();
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await app.close();
  }
}

async function seedInAppNotifications(
  service: NotificationService,
  dataSource: DataSource,
  args: string[],
) {
  const userId = args[1] ? parseInt(args[1], 10) : 1; 
  console.log(`🌱 Seeding in-app notifications for User ID: ${userId}...\n`);

  // Check if user exists
  const user = await dataSource.query('SELECT id, "userName" as name, role FROM users WHERE id = $1', [userId]);
  if (!user.length) {
     console.error(`❌ User ID ${userId} not found.`);
     return;
  }
  console.log(`👤 Target User: ${user[0].name} (${user[0].role})`);

  // Create notifications
  console.log('Creation 3 notifications...');
  
  await service.create(
    userId,
    'Schedule Confirmed',
    'Student John Doe confirmed attendance for Math Class on 2023-10-25 at 10:00.',
    'schedule_confirmed',
    { scheduleId: 123, studentId: 1, sessionId: 125 }
  );

  await service.create(
    userId,
    'Schedule Cancelled',
    'Parent requested to reschedule Science Class on 2023-10-26.',
    'schedule_cancelled',
    { scheduleId: 124, oldDate: '2023-10-26', studentId: 1, sessionId: 125 }
  );

  await service.create(
    userId,
    'Feedback Submitted',
    'Teacher Jane Smith submitted feedback for English Class.',
    'feedback_submitted',
    { scheduleId: 125, teacherId: 42, studentId: 1, sessionId: 125 }
  );

  console.log('✅ In-app notifications seeded successfully!');
  console.log('📱 Check the Notifications Page in the frontend.\n');
}

async function testSingleNotification(
  service: ScheduleNotificationService,
  dataSource: DataSource,
  args: string[],
) {
  const parentId = parseInt(args[1], 10);
  const scheduleId = parseInt(args[2], 10);

  if (!parentId || !scheduleId) {
    console.error('❌ Usage: npm run test-notification test <parentId> <scheduleId>');
    return;
  }

  console.log(`📤 Sending test notification...`);
  console.log(`   Parent ID: ${parentId}`);
  console.log(`   Schedule ID: ${scheduleId}\n`);

  // Get details
  const schedule = await dataSource.query(
    `SELECT s.*, st.name as "studentName", c.title as course, t.name as teacher
     FROM schedules s
     JOIN students st ON s."studentId" = st.id
     JOIN courses c ON s."courseId" = c.id
     LEFT JOIN teachers t ON s."teacherId" = t.id
     WHERE s.id = $1`,
    [scheduleId],
  );

  const parent = await dataSource.query(
    'SELECT id, name, email, "lineId" FROM parents WHERE id = $1',
    [parentId],
  );

  if (!schedule.length) {
    console.error('❌ Schedule not found');
    return;
  }

  if (!parent.length) {
    console.error('❌ Parent not found');
    return;
  }

  if (!parent[0].lineId) {
    console.error('❌ Parent does not have LINE linked');
    console.log('   Please link the parent to LINE first');
    return;
  }

  console.log('📋 Schedule Details:');
  console.log(`   Student: ${schedule[0].studentName}`);
  console.log(`   Course: ${schedule[0].course}`);
  console.log(`   Date: ${schedule[0].date}`);
  console.log(`   Time: ${schedule[0].startTime} - ${schedule[0].endTime}`);
  console.log(`   Room: ${schedule[0].room}`);
  console.log(`   Teacher: ${schedule[0].teacher || 'TBD'}`);
  console.log(`   Attendance: ${schedule[0].attendance}\n`);

  console.log('👤 Parent Details:');
  console.log(`   Name: ${parent[0].name}`);
  console.log(`   Email: ${parent[0].email}`);
  console.log(`   LINE ID: ${parent[0].lineId}\n`);

  await service.sendTestNotification(parentId, scheduleId);
  console.log('✅ Test notification sent successfully!');
  console.log('📱 Check the parent\'s LINE app\n');
}

async function testCronJob(
  service: ScheduleNotificationService,
  dataSource: DataSource,
) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 3);
  const dateString = targetDate.toISOString().split('T')[0];

  console.log(`📅 Testing cron job for date: ${dateString}\n`);

  // Check what schedules will be found
  const schedules = await dataSource.query(
    `SELECT s.*, st.name as "studentName", c.title as course
     FROM schedules s
     JOIN students st ON s."studentId" = st.id
     JOIN courses c ON s."courseId" = c.id
     WHERE s.date = $1 AND s.attendance = 'pending'`,
    [dateString],
  );

  console.log(`📋 Found ${schedules.length} eligible schedules:\n`);

  if (schedules.length === 0) {
    console.log('⚠️  No schedules found for 3 days from now with pending attendance');
    console.log('   Create a test schedule with: npm run test-notification create\n');
    return;
  }

  for (const schedule of schedules) {
    console.log(`   - Schedule #${schedule.id}: ${schedule.studentName} - ${schedule.course}`);
    console.log(`     Date: ${schedule.date}, Time: ${schedule.startTime} - ${schedule.endTime}`);
    console.log(`     Room: ${schedule.room}\n`);
  }

  console.log('🔄 Running daily notification job...\n');
  await service.sendDailyNotifications();
  console.log('\n✅ Daily notification job completed!');
  console.log('📱 Check the parent LINE apps for notifications\n');
}

async function listEligibleSchedules(dataSource: DataSource) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 3);
  const dateString = targetDate.toISOString().split('T')[0];

  console.log(`📅 Listing eligible schedules for: ${dateString}\n`);

  const schedules = await dataSource.query(
    `SELECT s.id, s.date, s."startTime", s."endTime", s.room, s.attendance,
            st.id as "studentId", st.name as "studentName",
            c.title as course,
            t.name as teacher,
            p.id as "parentId", p.name as "parentName", p."lineId"
     FROM schedules s
     JOIN students st ON s."studentId" = st.id
     JOIN courses c ON s."courseId" = c.id
     LEFT JOIN teachers t ON s."teacherId" = t.id
     JOIN parent_students ps ON ps."studentId" = st.id
     JOIN parents p ON p.id = ps."parentId"
     WHERE s.date = $1 AND s.attendance = 'pending'
     ORDER BY s."startTime"`,
    [dateString],
  );

  if (schedules.length === 0) {
    console.log('⚠️  No eligible schedules found\n');
    console.log('Criteria:');
    console.log(`   - Date: ${dateString} (3 days from now)`);
    console.log('   - Attendance: pending');
    console.log('   - Student has parent with LINE linked\n');
    console.log('Create a test schedule with: npm run test-notification create\n');
    return;
  }

  console.log(`Found ${schedules.length} eligible schedules:\n`);

  for (const schedule of schedules) {
    console.log(`📋 Schedule #${schedule.id}`);
    console.log(`   Student: ${schedule.studentName} (ID: ${schedule.studentId})`);
    console.log(`   Course: ${schedule.course}`);
    console.log(`   Date: ${schedule.date}`);
    console.log(`   Time: ${schedule.startTime} - ${schedule.endTime}`);
    console.log(`   Room: ${schedule.room}`);
    console.log(`   Teacher: ${schedule.teacher || 'TBD'}`);
    console.log(`   Parent: ${schedule.parentName} (ID: ${schedule.parentId})`);
    console.log(`   LINE: ${schedule.lineId ? '✅ Linked' : '❌ Not linked'}`);
    console.log('');
  }

  console.log('💡 To test a specific notification, run:');
  console.log(`   npm run test-notification test <parentId> <scheduleId>\n`);
}

async function createTestSchedule(dataSource: DataSource, args: string[]) {
  console.log('🔨 Creating test schedule...\n');

  // Get first parent with LINE linked
  const parents = await dataSource.query(
    `SELECT p.id, p.name, p."lineId", ps."studentId", st.name as "studentName"
     FROM parents p
     JOIN parent_students ps ON ps."parentId" = p.id
     JOIN students st ON st.id = ps."studentId"
     WHERE p."lineId" IS NOT NULL
     LIMIT 1`,
  );

  if (!parents.length) {
    console.error('❌ No parent with LINE linked found');
    console.log('   Please link a parent to LINE first\n');
    return;
  }

  const parent = parents[0];
  console.log(`👤 Using parent: ${parent.name} (ID: ${parent.id})`);
  console.log(`   Student: ${parent.studentName} (ID: ${parent.studentId})\n`);

  // Get a course and session
  const courses = await dataSource.query('SELECT id, title FROM courses LIMIT 1');
  const sessions = await dataSource.query('SELECT id FROM sessions LIMIT 1');
  const teachers = await dataSource.query('SELECT id, name FROM teachers LIMIT 1');

  if (!courses.length || !sessions.length) {
    console.error('❌ No courses or sessions found');
    console.log('   Create a course and session first\n');
    return;
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 3);
  const dateString = targetDate.toISOString().split('T')[0];

  // Create schedule
  const result = await dataSource.query(
    `INSERT INTO schedules (
      "sessionId", "courseId", "studentId", "teacherId",
      date, "startTime", "endTime", room,
      attendance, remark, warning, feedback, "verifyFb"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id`,
    [
      sessions[0].id,
      courses[0].id,
      parent.studentId,
      teachers.length ? teachers[0].id : null,
      dateString,
      '10:00',
      '12:00',
      'Test Room 101',
      'pending',
      '',
      '',
      '',
      false,
    ],
  );

  const scheduleId = result[0].id;

  console.log('✅ Test schedule created successfully!\n');
  console.log('📋 Schedule Details:');
  console.log(`   Schedule ID: ${scheduleId}`);
  console.log(`   Student: ${parent.studentName}`);
  console.log(`   Course: ${courses[0].title}`);
  console.log(`   Date: ${dateString} (3 days from now)`);
  console.log(`   Time: 10:00 - 12:00`);
  console.log(`   Room: Test Room 101`);
  console.log(`   Teacher: ${teachers.length ? teachers[0].name : 'TBD'}`);
  console.log(`   Attendance: pending\n`);

  console.log('💡 Test the notification with:');
  console.log(`   npm run test-notification test ${parent.id} ${scheduleId}\n`);
  console.log('💡 Or trigger the cron job:');
  console.log(`   npm run test-notification cron\n`);
}

function printHelp() {
  console.log('📨 Notification Testing Commands\n');
  console.log('Usage: npm run test-notification <command> [args]\n');
  console.log('Commands:');
  console.log('  test <parentId> <scheduleId>  - Send test notification to specific parent');
  console.log('  cron                          - Trigger the daily notification cron job');
  console.log('  list                          - List all eligible schedules (3 days from now)');
  console.log('  create                        - Create a test schedule for testing');
  console.log('  seed [userId]                 - Seed in-app notifications (default user: 1)\n');
  console.log('Examples:');
  console.log('  npm run test-notification test 1 42');
  console.log('  npm run test-notification cron');
  console.log('  npm run test-notification list');
  console.log('  npm run test-notification create');
  console.log('  npm run test-notification seed 1\n');
}

bootstrap().catch((error) => {
  console.error('Failed to start test script:', error);
  process.exit(1);
});
