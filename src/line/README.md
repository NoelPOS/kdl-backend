# LINE Integration Module

This module provides complete LINE Bot and LIFF app integration for the KDL Learning Management System, enabling parents to receive schedule notifications and manage their children's classes through LINE.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Setup Instructions](#setup-instructions)
- [API Endpoints](#api-endpoints)
- [User Flow](#user-flow)
- [Environment Variables](#environment-variables)
- [Testing](#testing)

## ✨ Features

### For Parents
- ✅ Receive schedule notifications 3 days in advance
- ✅ Confirm class attendance via LINE button
- ✅ Request reschedule via LINE button
- ✅ View all children's schedules in LIFF app
- ✅ Rich menu navigation (keyboard replacement)

### For Administrators
- ✅ Automated daily notifications (9 AM cron job)
- ✅ Parent verification and LINE account linking
- ✅ Security validation (parent ownership checks)
- ✅ Audit logging for all actions

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LINE Platform                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Messaging    │  │  Rich Menu   │  │   LIFF App   │      │
│  │     API      │  │   Service    │  │   Runtime    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   NestJS Backend                            │
│                                                             │
│  Controllers:                                               │
│  ├── LineController (webhook events)                       │
│  └── ParentPortalController (LIFF APIs)                    │
│                                                             │
│  Services:                                                  │
│  ├── LineMessagingService (send messages)                  │
│  ├── RichMenuService (menu management)                     │
│  ├── ParentVerificationService (link LINE accounts)        │
│  └── ScheduleNotificationService (cron + confirm/reschedule)│
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Setup Instructions

### 1. Create LINE Official Account

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Create a new provider (e.g., "KDL")
3. Create a **Messaging API** channel:
   - Channel name: "KDL Bot"
   - Channel description: "Learning management bot"
   - Category: Education
   - Email: your@email.com

4. In the **Messaging API** tab:
   - Get **Channel Access Token** (long-lived) 
   - Get **Channel Secret**  
   - Set **Webhook URL**: `https://kdl-backend.vercel.app/api/v1/line/webhook` 
   - Enable **Use webhook**
   - Disable **Auto-reply messages**
   - Disable **Greeting messages** (we send custom welcome)

### 2. Create LIFF App

1. In the LINE channel settings, go to **LIFF** tab
2. Click **Add** to create a new LIFF app:
   - LIFF app name: "KDL Parent Portal"
   - Size: Full
   - Endpoint URL: `https://kdl-frontend.vercel.app/liff`
   - Scope: `profile`, `openid`
   - Bot link feature: On (Normal)

3. Get the **LIFF ID** (format: `1234567890-abcdefgh`)

### 3. Configure Environment Variables

Add to your `backend.env`:

```env
# LINE Bot Configuration
LINE_CHANNEL_ACCESS_TOKEN=43c1c7d1a115adc92e4f61c1f7cf1ec3
LINE_CHANNEL_SECRET=xGM5GEEyTwmFc/AapFDwrYfz30YJzKihFghaDDkEL1sdga4mqZ8TuP6pcFHa0d/mzcsOfFS8GiALOXacCBhc/+CkBGnCtUMIK3Shhaxu20+D1m4df+R9sVBLS9LkFlGtUdDWFXGzq8/sgUaH2GYypAdB04t89/1O/w1cDnyilFU=
LINE_LIFF_ID=2008403698-g6d9DA22

# Frontend URL for LIFF
FRONTEND_URL=https://kdl-frontend.vercel.app

### 4. Create Rich Menu Images

Create two PNG images (2500x843 px):

**Unverified Menu** (`unverified-menu.png`):
```
┌─────────────────────────────────────┐
│                                     │
│         🔐 LOGIN & VERIFY           │
│                                     │
└─────────────────────────────────────┘
```

**Verified Menu** (`verified-menu.png`):
```
┌─────────────────────────────────────┐
│                                     │
│         📱 MY PORTAL                │
│                                     │
└─────────────────────────────────────┘
```

Upload via LINE Developers Console or use the SDK programmatically.

### 5. Initialize Rich Menus

Uncomment this line in `line.module.ts`:

```typescript
async onModuleInit() {
  await this.richMenuService.initializeRichMenus();
}
```

### 6. Test the Bot

1. Add your bot using the QR code from LINE Developers Console
2. You should receive the welcome message
3. Click "Login & Verify" to link your account

## 📡 API Endpoints

### Webhook Endpoints

#### POST `/line/webhook`
Receives all LINE events (follow, message, postback).

**Headers:**
- `x-line-signature`: LINE signature for validation

**Body:**
```json
{
  "events": [
    {
      "type": "follow|message|postback",
      "replyToken": "...",
      "source": { "userId": "U1234567890" },
      ...
    }
  ]
}
```

### Parent Portal Endpoints (for LIFF)

#### POST `/parents/verify`
Link LINE user ID to parent account.

**Body:**
```json
{
  "lineUserId": "U1234567890",
  "email": "parent@example.com",
  "contactNo": "0812345678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Parent account successfully verified and linked",
  "parent": {
    "id": 1,
    "name": "John Doe",
    "email": "parent@example.com"
  }
}
```

#### GET `/parents/profile?lineUserId=U1234567890`
Get parent profile by LINE user ID.

**Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "parent@example.com",
  "contactNo": "0812345678",
  "lineId": "U1234567890",
  "address": "Bangkok, Thailand"
}
```

#### GET `/parents/:parentId/children`
Get parent's children list.

**Query Parameters:**
- `query` (optional): Search by child name
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 12)

**Response:**
```json
{
  "children": [
    {
      "id": 1,
      "parentId": 1,
      "studentId": 10,
      "isPrimary": true,
      "student": {
        "id": 10,
        "name": "Alex",
        "nickname": "Alex",
        "profilePicture": "https://...",
        "studentId": "202508001"
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalCount": 2,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### GET `/parents/students/:studentId/sessions`
Get student's courses (sessions).

**Response:**
```json
[
  {
    "id": 5,
    "studentId": 10,
    "courseId": 2,
    "status": "wip",
    "payment": "paid",
    "course": {
      "id": 2,
      "title": "Tinkerer Beginner",
      "price": 8000
    },
    "teacher": {
      "id": 3,
      "name": "Miss Lily"
    },
    "classOption": {
      "id": 1,
      "classMode": "online",
      "classCount": 12
    }
  }
]
```

#### GET `/parents/sessions/:sessionId/schedules`
Get all schedules for a session.

**Response:**
```json
[
  {
    "schedule_id": 100,
    "schedule_date": "2025-10-10",
    "schedule_startTime": "10:00",
    "schedule_endTime": "12:00",
    "schedule_room": "Lasalle's Avenue, Front Room",
    "schedule_attendance": "pending",
    "schedule_feedback": "",
    "teacher_name": "Miss Lily",
    "course_title": "Tinkerer Beginner"
  }
]
```

#### GET `/parents/schedules/:scheduleId`
Get single schedule details.

**Response:**
```json
{
  "id": 100,
  "date": "2025-10-10",
  "startTime": "10:00",
  "endTime": "12:00",
  "room": "Lasalle's Avenue, Front Room",
  "attendance": "pending",
  "feedback": "",
  "remark": "",
  "student": { ... },
  "teacher": { ... },
  "course": { ... }
}
```

## 👤 User Flow

### 1. New Parent Adds Bot

```
User adds KDL Bot
   ↓
Follow Event → handleFollowEvent()
   ↓
Check if lineId exists in database
   ↓
   ├── Not Found → Send Welcome Message
   │   └── Show "Login & Verify" button
   │       └── Assign Unverified Rich Menu
   │
   └── Found → Send Welcome Back Message
       └── Assign Verified Rich Menu
```

### 2. Parent Verification Flow

```
Parent clicks "Login & Verify"
   ↓
Opens LIFF Login Page
   ↓
LIFF gets LINE user ID via liff.getProfile()
   ↓
Parent enters Email OR Phone
   ↓
POST /parents/verify
   ↓
Backend validates:
   ├── Parent exists in database?
   ├── LINE ID not already linked?
   └── Email/Phone matches?
   ↓
Update parent.lineId = LINE user ID
   ↓
Assign Verified Rich Menu
   ↓
Send success message
```

### 3. Daily Notification Flow

```
Cron Job runs at 9:00 AM daily
   ↓
Query schedules WHERE date = CURRENT_DATE + 3
   AND attendance = 'pending'
   ↓
For each schedule:
   ├── Find student
   ├── Find all parents of student
   └── Filter parents WHERE lineId IS NOT NULL
   ↓
Send Flex Message Notification:
   ├── Student name, course, date, time, room
   ├── [✅ Confirm] button
   ├── [🔄 Reschedule] button
   └── [📱 View Details] link to LIFF
```

### 4. Confirm Schedule Flow

```
Parent clicks [✅ Confirm]
   ↓
Postback Event → handlePostbackEvent()
   ↓
Parse data: action=confirm&scheduleId=123
   ↓
Validate parent ownership:
   SELECT FROM parent_students
   WHERE parentId = (parent with lineId)
   AND studentId = (schedule's studentId)
   ↓
   ├── Not Authorized → Send error message
   │
   └── Authorized → Update schedule:
       ├── attendance = 'confirmed'
       └── remark = 'Confirmed by parent via LINE'
       ↓
       Send success message
```

### 5. Reschedule Request Flow

```
Parent clicks [🔄 Reschedule]
   ↓
Validate parent ownership (same as confirm)
   ↓
Update schedule:
   ├── attendance = 'cancelled'
   └── remark = 'Reschedule requested by parent via LINE'
   ↓
Create replacement schedule (automatic in updateSchedule)
   ↓
Send acknowledgment message:
   "We'll contact you within 24 hours to confirm new schedule"
```

### 6. LIFF App Access Flow

```
Parent clicks "My Portal" in Rich Menu
   ↓
Opens LIFF: https://liff.line.me/{LIFF_ID}/children
   ↓
LIFF SDK initializes:
   ├── liff.init()
   ├── liff.isLoggedIn()
   └── liff.getProfile() → Get LINE user ID
   ↓
Fetch parent profile:
   GET /parents/profile?lineUserId={userId}
   ↓
Display Child Selector Page:
   GET /parents/{parentId}/children
   ↓
Parent selects child
   ↓
Display Course List Page:
   GET /parents/students/{studentId}/sessions
   ↓
Parent selects course
   ↓
Display Calendar/Schedule Page:
   GET /parents/sessions/{sessionId}/schedules
   ↓
Parent clicks schedule
   ↓
Display Schedule Detail Page:
   GET /parents/schedules/{scheduleId}
   ├── Show details
   ├── [Confirm] button → Call webhook
   └── [Reschedule] button → Call webhook
```

## 🔒 Security Features

### 1. Webhook Signature Validation
All webhook requests are validated using LINE's signature:

```typescript
validateSignature(body: string, signature: string): boolean
```

### 2. Parent Ownership Validation
Before allowing any schedule action:

```typescript
async validateParentOwnership(lineUserId: string, scheduleId: number): Promise<boolean>
```

### 3. LINE Account Linking Checks
- Prevents duplicate LINE accounts per parent
- Validates email/phone before linking
- Logs all verification attempts

## 🧪 Testing

### Manual Testing

1. **Test Welcome Message:**
   - Add bot → Should receive welcome message
   - Rich menu should show "Please Login"

2. **Test Verification:**
   - Click "Login & Verify"
   - Enter valid parent email
   - Should receive success message
   - Rich menu should change to "KDL Portal"

3. **Test Notification (Manual Trigger):**
   ```typescript
   // Add this endpoint for testing
   @Get('test-notification/:parentId/:scheduleId')
   async testNotification(
     @Param('parentId') parentId: number,
     @Param('scheduleId') scheduleId: number,
   ) {
     return this.scheduleNotificationService.sendTestNotification(
       parentId,
       scheduleId,
     );
   }
   ```

4. **Test Confirm Button:**
   - Send test notification
   - Click [✅ Confirm]
   - Should receive success message
   - Check database: attendance = 'confirmed'

5. **Test LIFF App:**
   - Click "My Portal"
   - Should see child selector
   - Click child → See courses
   - Click course → See schedules

### Automated Testing

```bash
# Unit tests
npm test src/line

# E2E tests
npm run test:e2e
```

## 📊 Monitoring & Logs

All LINE operations are logged:

```
[LineMessagingService] Sent text message to U1234567890
[RichMenuService] Assigned verified menu to user U1234567890
[ParentVerificationService] Successfully linked LINE user U1234567890 to parent 5 (John Doe)
[ScheduleNotificationService] Starting daily schedule notification job...
[ScheduleNotificationService] Found 15 schedules to notify
[LineController] Received event type: postback
```

Monitor logs for:
- Failed message delivery
- Invalid webhook signatures
- Unauthorized access attempts
- Cron job execution status

## 🛠️ Troubleshooting

### Issue: Webhook not receiving events
**Solution:**
1. Check webhook URL in LINE Console
2. Verify SSL certificate is valid
3. Test webhook with ngrok for local development:
   ```bash
   ngrok http 4000
   # Use https://xxx.ngrok.io/line/webhook
   ```

### Issue: Rich menu not showing
**Solution:**
1. Check if menus were created: Check logs on startup
2. Manually create via LINE Console
3. Verify menu assignment in logs

### Issue: LIFF app won't open
**Solution:**
1. Verify LIFF ID is correct
2. Check CORS settings allow frontend domain
3. Test LIFF URL directly in browser

### Issue: Cron job not running
**Solution:**
1. Check server timezone (should be Asia/Bangkok)
2. Verify @nestjs/schedule is imported in module
3. Check logs at 9:00 AM for job execution

## 📚 Additional Resources

- [LINE Messaging API Documentation](https://developers.line.biz/en/docs/messaging-api/)
- [LINE Login Documentation](https://developers.line.biz/en/docs/line-login/)
- [LIFF Documentation](https://developers.line.biz/en/docs/liff/)
- [Flex Message Simulator](https://developers.line.biz/flex-simulator/)

## 🤝 Support

For issues or questions:
1. Check logs: `tail -f logs/application.log`
2. Review LINE Developers Console > Logs
3. Contact KDL development team

---

**Last Updated:** November 2, 2025  
**Version:** 1.0.0  
**Author:** KDL Development Team
