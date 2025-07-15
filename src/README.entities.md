# Database Entities & Relationships

This document summarizes all TypeORM entities and their relationships in the codebase. Use this as a reference for database structure, relations, and for future prompts.

---

## **Entity-Relationship Diagram (Textual Overview)**

- **UserEntity** (users)
  - OneToMany: Token (tokens)
- **Token** (tokens)
  - ManyToOne: UserEntity (users)
- **ParentEntity** (parents)
- **StudentEntity** (students)
- **TeacherEntity** (teachers)
- **CourseEntity** (courses)
- **ClassOption** (class_options)
- **Session** (sessions)
  - ManyToOne: CourseEntity (courses)
  - ManyToOne: StudentEntity (students)
  - ManyToOne: ClassOption (class_options)
- **Invoice** (invoices)
  - OneToOne: CoursePlus (course_plus)
  - OneToOne: Session (sessions)
  - OneToMany: InvoiceItem (invoice_items)
- **InvoiceItem** (invoice_items)
  - ManyToOne: Invoice (invoices)
- **Receipt** (receipts)
  - OneToOne: Invoice (invoices)
- **Schedule** (schedules)
  - ManyToOne: CourseEntity (courses)
  - ManyToOne: StudentEntity (students)
  - ManyToOne: TeacherEntity (teachers)
  - ManyToOne: Session (sessions)
- **CoursePlus** (course_plus)
- **RoomEntity** (rooms)

---

## **Entities by Module**

### **Auth Module**

- **Token** (`tokens`)
  - `id: string (uuid)`
  - `userId: string`
  - `token: string`
  - `type: enum (FORGOT_PASSWORD | VERIFY_EMAIL)`
  - `expireIn: Date`
  - `createdAt: Date`
  - `updatedAt: Date`
  - **Relations:**
    - ManyToOne: UserEntity (users)

---

### **User Module**

- **UserEntity** (`users`)
  - `id: number`
  - `createdAt: Date`
  - `updatedAt: Date`
  - `userName: string`
  - `email: string`
  - `password: string`
  - `role: string`
  - `refreshToken: string`
  - `isVerified: boolean`
  - **Relations:**
    - OneToMany: Token (tokens)

- **ParentEntity** (`parents`)
  - `id: number`
  - `createdAt: Date`
  - `name: string`
  - `email: string`
  - `contactNo: string`
  - `lineId: string`
  - `address: string`

- **StudentEntity** (`students`)
  - `id: number`
  - `createdAt: Date`
  - `name: string`
  - `nickname: string`
  - `dob: string`
  - `gender: string`
  - `school: string`
  - `allergic: string[]`
  - `doNotEat: string[]`
  - `adConcent: boolean`
  - `phone: string`
  - `profilePicture: string`

- **TeacherEntity** (`teachers`)
  - `id: number`
  - `createdAt: Date`
  - `name: string`
  - `email: string`
  - `contactNo: string`
  - `lineId: string`
  - `address: string`
  - `profilePicture: string`

---

### **Course Module**

- **CourseEntity** (`courses`)
  - `id: number`
  - `createdAt: Date`
  - `title: string`
  - `description: string`
  - `ageRange: string`
  - `medium: string`

---

### **Session Module**

- **ClassOption** (`class_options`)
  - `id: number`
  - `classMode: string`
  - `classLimit: number`
  - `tuitionFee: number`
  - `effectiveStartDate: Date`
  - `effectiveEndDate: Date`

- **Session** (`sessions`)
  - `id: number`
  - `studentId: number`
  - `courseId: number`
  - `classOptionId: number`
  - `classCancel: number`
  - `payment: string`
  - `status: string`
  - `invoiceDone: boolean`
  - `createdAt: Date`
  - **Relations:**
    - ManyToOne: CourseEntity (courses)
    - ManyToOne: StudentEntity (students)
    - ManyToOne: ClassOption (class_options)

- **Invoice** (`invoices`)
  - `id: number`
  - `documentId: string`
  - `date: Date`
  - `paymentMethod: string`
  - `totalAmount: number`
  - `sessionId: number`
  - `coursePlusId: number`
  - `receiptDone: boolean`
  - **Relations:**
    - OneToOne: CoursePlus (course_plus)
    - OneToOne: Session (sessions)
    - OneToMany: InvoiceItem (invoice_items)

- **InvoiceItem** (`invoice_items`)
  - `id: number`
  - `invoiceId: number`
  - `description: string`
  - `amount: number`
  - **Relations:**
    - ManyToOne: Invoice (invoices)

- **Receipt** (`receipts`)
  - `id: number`
  - `invoiceId: number`
  - `date: Date`
  - **Relations:**
    - OneToOne: Invoice (invoices)

---

### **Schedule Module**

- **Schedule** (`schedules`)
  - `id: number`
  - `createdAt: Date`
  - `sessionId: number`
  - `courseId: number`
  - `studentId: number`
  - `teacherId: number`
  - `date: Date`
  - `startTime: string`
  - `endTime: string`
  - `room: string`
  - `attendance: string`
  - `remark: string`
  - `warning: string`
  - `feedback: string`
  - `verifyFb: boolean`
  - `classNumber?: number`
  - `coursePlusId?: number`
  - **Relations:**
    - ManyToOne: CourseEntity (courses)
    - ManyToOne: StudentEntity (students)
    - ManyToOne: TeacherEntity (teachers)
    - ManyToOne: Session (sessions)

---

### **Course-Plus Module**

- **CoursePlus** (`course_plus`)
  - `id: number`
  - `sessionId: number`
  - `classNo: number`
  - `amount: number`
  - `payment: boolean`
  - `description: string`

---

### **Room Module**

- **RoomEntity** (`rooms`)
  - `id: number`
  - `name: string`

---

## **Legend**

- **OneToMany**: One entity has many of the related entity.
- **ManyToOne**: Many entities relate to one of the referenced entity.
- **OneToOne**: One entity relates to one of the referenced entity.
- Table names in parentheses.
