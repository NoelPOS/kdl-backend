import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  NotFoundException,
  Query,
  DefaultValuePipe,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { Session } from './entities/session.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { InvoiceFilterDto } from './dto/invoice-filter.dto';
import { ReceiptFilterDto } from './dto/receipt-filter.dto';
import { CreateClassOptionDto } from './dto/create-class-option.dto';
import { PaginatedSessionResponseDto } from './dto/paginated-session-response.dto';
import { PaginatedInvoiceResponseDto } from './dto/paginated-invoice-response.dto';
import { StudentSessionFilterDto } from './dto/student-session-filter.dto';
import { PaginatedSessionOverviewResponseDto } from './dto/paginated-session-overview-response.dto';
import { AddCoursePlusDto } from './dto/add-course-plus.dto';

@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @ApiTags('Sessions')
  @Post()
  @ApiOperation({ summary: 'Create a new session' })
  @ApiBody({ type: CreateSessionDto })
  @ApiResponse({
    status: 201,
    description: 'The session has been successfully created.',
    type: Session,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  create(@Body() createSessionDto: CreateSessionDto) {
    return this.sessionService.create(createSessionDto);
  }

  @ApiTags('Sessions')
  @Post('course-plus')
  @ApiOperation({ summary: 'Add course plus to an existing session' })
  @ApiBody({ type: AddCoursePlusDto })
  @ApiResponse({
    status: 201,
    description: 'Course plus has been successfully added.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  addCoursePlus(@Body() addCoursePlusDto: AddCoursePlusDto) {
    return this.sessionService.addCoursePlus(addCoursePlusDto);
  }

  @ApiTags('Sessions')
  @Get()
  @ApiOperation({ summary: 'Get all sessions' })
  @ApiResponse({
    status: 200,
    description: 'List of all sessions',
    type: [Session],
  })
  findAll() {
    return this.sessionService.findAll();
  }

  @ApiTags('Sessions')
  @Get('overview/:studentId')
  @ApiOperation({ summary: "Get a student's session overview" })
  @ApiParam({ name: 'studentId', type: 'number' })
  @ApiResponse({ status: 200, description: "The student's session overview" })
  getStudentSessionOverview(
    @Param('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.sessionService.getSessionOverviewByStudentId(studentId);
  }

  @ApiTags('Sessions')
  @Get('student/:studentId')
  @ApiOperation({ summary: "Get all of a student's sessions" })
  @ApiParam({ name: 'studentId', type: 'number' })
  @ApiResponse({
    status: 200,
    description: "The student's sessions",
    type: [Session],
  })
  getStudentSessions(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.sessionService.getStudentSessions(studentId);
  }

  @ApiTags('Sessions')
  @Get('student/:studentId/filtered')
  @ApiOperation({ summary: 'Get filtered student sessions with pagination' })
  @ApiParam({ name: 'studentId', type: 'number' })
  @ApiQuery({
    name: 'courseName',
    required: false,
    description: 'Filter by course name',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (completed/wip)',
  })
  @ApiQuery({
    name: 'payment',
    required: false,
    description: 'Filter by payment status (paid/unpaid)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: 'number',
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Items per page (default: 12)',
  })
  @ApiResponse({
    status: 200,
    description: 'Filtered student sessions with pagination',
    type: PaginatedSessionOverviewResponseDto,
  })
  getStudentSessionsFiltered(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() filterDto: StudentSessionFilterDto,
  ) {
    return this.sessionService.getStudentSessionsFiltered(studentId, filterDto);
  }

  @ApiTags('Sessions')
  @Get('student/:studentId/course/:courseId')
  @ApiOperation({ summary: "Get a student's session by course" })
  @ApiParam({ name: 'studentId', type: 'number' })
  @ApiParam({ name: 'courseId', type: 'number' })
  @ApiResponse({
    status: 200,
    description: "The student's session for a specific course",
    type: Session,
  })
  getStudentSessionByCourse(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    return this.sessionService.getStudentSessionByCourse(studentId, courseId);
  }

  @ApiTags('Sessions')
  @Get('package/:packageId')
  @ApiOperation({ summary: 'Get sessions created from a specific package' })
  @ApiParam({ name: 'packageId', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Sessions created from the specified package',
    type: [Session],
  })
  getSessionsByPackage(@Param('packageId', ParseIntPipe) packageId: number) {
    return this.sessionService.getSessionsByPackage(packageId);
  }

  @ApiTags('Class Options')
  @Post('class-options')
  @ApiOperation({ summary: 'Create a new class option' })
  @ApiBody({ type: CreateClassOptionDto })
  @ApiResponse({
    status: 201,
    description: 'The class option has been successfully created.',
  })
  createClassOption(@Body() dto: any) {
    console.log(dto);
    return this.sessionService.createClassOption(dto);
  }

  @ApiTags('Class Options')
  @Get('class-options')
  @ApiOperation({ summary: 'Get all class options' })
  @ApiResponse({ status: 200, description: 'Returns all class options' })
  listClassOptions() {
    return this.sessionService.listClassOptions();
  }

  @ApiTags('Invoices')
  @Get('pending-invoice')
  @ApiOperation({
    summary: 'Get sessions pending invoice with filtering and pagination',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Filter by creation date (YYYY-MM-DD format)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (pending/completed)',
  })
  @ApiQuery({
    name: 'course',
    required: false,
    description: 'Filter by course name',
  })
  @ApiQuery({
    name: 'teacher',
    required: false,
    description: 'Filter by teacher name',
  })
  @ApiQuery({
    name: 'student',
    required: false,
    description: 'Filter by student name',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: 'number',
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'transactionType',
    required: false,
    description:
      'Filter by transaction type: course, courseplus, package, or all',
    enum: ['course', 'courseplus', 'package', 'all'],
  })
  @ApiResponse({
    status: 200,
    description: 'List of sessions pending invoice with pagination',
    type: PaginatedSessionResponseDto,
  })
  getPendingSessionsForInvoice(
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('course') course?: string,
    @Query('teacher') teacher?: string,
    @Query('student') student?: string,
    @Query('transactionType') transactionType?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.sessionService.getPendingSessionsForInvoice(
      date,
      status,
      course,
      teacher,
      student,
      transactionType,
      page,
      limit,
    );
  }

  @ApiTags('Invoices')
  @Get('pending-invoice/:sessionId')
  @ApiOperation({ summary: 'Get a specific session pending invoice' })
  @ApiParam({ name: 'sessionId' })
  @ApiResponse({
    status: 200,
    description: 'The session pending invoice',
    type: Session,
  })
  getSpecificPendingSessionsForInvoice(
    @Param('sessionId') sessionId: number | string,
  ) {
    return this.sessionService.getSpecificPendingSessionsForInvoice(sessionId);
  }

  @ApiTags('Invoices')
  @Post('invoices')
  @ApiOperation({
    summary: 'Create a new invoice and mark session as invoiced (atomic)',
  })
  @ApiBody({ type: CreateInvoiceDto })
  @ApiResponse({
    status: 201,
    description:
      'The invoice has been successfully created and the session marked as invoiced.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  createInvoice(@Body() createInvoiceDto: CreateInvoiceDto) {
    console.log(createInvoiceDto);
    return this.sessionService.createInvoiceAndMarkSession(createInvoiceDto);
  }

  @ApiTags('Invoices')
  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get an invoice by ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'The found invoice', type: Session })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  getInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.sessionService.getInvoice(id);
  }

  @ApiTags('Invoices')
  @Get('invoices')
  @ApiOperation({ summary: 'List all invoices (paginated, filterable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'documentId', required: false, type: String })
  @ApiQuery({ name: 'student', required: false, type: String })
  @ApiQuery({ name: 'course', required: false, type: String })
  @ApiQuery({ name: 'receiptDone', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Paginated, filterable list of invoices',
    type: PaginatedInvoiceResponseDto,
  })
  getInvoices(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('documentId') documentId?: string,
    @Query('student') student?: string,
    @Query('course') course?: string,
    @Query('receiptDone') receiptDone?: string,
  ) {
    return this.sessionService.listInvoices(
      page,
      limit,
      documentId,
      student,
      course,
      receiptDone,
    );
  }

  @ApiTags('Receipts')
  @Post('receipts')
  @ApiOperation({
    summary:
      'Create a new receipt, mark session as paid, and mark invoice as receipt done (atomic)',
  })
  @ApiBody({ type: CreateReceiptDto })
  @ApiResponse({
    status: 201,
    description:
      'The receipt has been successfully created, the session marked as paid, and the invoice marked as receipt done.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  createReceipt(@Body() createReceiptDto: CreateReceiptDto) {
    return this.sessionService.createReceiptAndMarkPaid(createReceiptDto);
  }

  @ApiTags('Receipts')
  @Get('receipts/:id')
  @ApiOperation({ summary: 'Get a receipt by ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'The found receipt', type: Session })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  getReceipt(@Param('id', ParseIntPipe) id: number) {
    return this.sessionService.getReceipt(id);
  }

  @ApiTags('Receipts')
  @Get('receipts')
  @ApiOperation({ summary: 'List all receipts (paginated, filterable)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated, filterable list of receipts',
  })
  getReceipts(@Query() query: ReceiptFilterDto) {
    return this.sessionService.listReceipts(query);
  }

  @ApiTags('Sessions')
  @Get(':id')
  @ApiOperation({ summary: 'Get a session by ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'The found session', type: Session })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const session = await this.sessionService.findOne(id);
    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    return session;
  }

  @ApiTags('Sessions')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a session' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({ type: UpdateSessionDto })
  @ApiResponse({
    status: 200,
    description: 'The session has been successfully updated.',
    type: Session,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSessionDto: UpdateSessionDto,
  ) {
    const updatedSession = await this.sessionService.update(
      id,
      updateSessionDto,
    );
    if (!updatedSession) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    return updatedSession;
  }

  @ApiTags('Sessions')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a session' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'The session has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sessionService.remove(id);
  }
}
