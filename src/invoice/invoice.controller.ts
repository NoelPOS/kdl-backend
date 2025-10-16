import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceFilterDto } from './dto/invoice-filter.dto';
import { PaginatedInvoiceResponseDto } from './dto/paginated-invoice-response.dto';
import { Invoice } from './entities/invoice.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('invoices')
@ApiTags('Invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.REGISTRAR)
@ApiBearerAuth('JWT-auth')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get('next-document-id')
  @ApiOperation({ summary: 'Get the next available document ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the next document ID that would be generated',
    schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          example: '202508120001',
        },
      },
    },
  })
  async getNextDocumentId() {
    const documentId = await this.invoiceService.getNextDocumentId();
    return { documentId };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new invoice' })
  @ApiBody({ type: CreateInvoiceDto })
  @ApiResponse({
    status: 201,
    description: 'The invoice has been successfully created.',
    type: Invoice,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoiceService.create(createInvoiceDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all invoices (paginated, filterable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'documentId', required: false, type: String })
  @ApiQuery({ name: 'student', required: false, type: String, description: 'Filter by student name' })
  @ApiQuery({ name: 'course', required: false, type: String, description: 'Filter by course name' })
  @ApiQuery({
    name: 'receiptDone',
    required: false,
    type: String,
    description: 'Filter by receipt status: completed, pending, or all',
    enum: ['completed', 'pending', 'all'],
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated, filterable list of invoices',
    type: PaginatedInvoiceResponseDto,
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('documentId') documentId?: string,
    @Query('student') student?: string,
    @Query('course') course?: string,
    @Query('receiptDone') receiptDone?: string,
  ) {
    const filterDto: InvoiceFilterDto = {
      page,
      limit,
      documentId,
      student,
      course,
      receiptDone,
    };
    return this.invoiceService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice by ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'The found invoice',
    type: Invoice,
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.invoiceService.findOne(id);
  }

  @Patch(':id/mark-receipt-done')
  @ApiOperation({ summary: 'Mark invoice as receipt done' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Invoice has been marked as receipt done.',
    type: Invoice,
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  markReceiptDone(@Param('id', ParseIntPipe) id: number) {
    return this.invoiceService.markReceiptDone(id);
  }

  @Patch(':id/payment-method')
  @ApiOperation({
    summary: 'Update invoice payment method',
    description:
      'Update the payment method of an existing invoice. Used by frontend when payment method is changed.',
  })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({
    description: 'Payment method update payload',
    schema: {
      type: 'object',
      properties: {
        paymentMethod: {
          type: 'string',
          description: 'New payment method for the invoice',
          example: 'Credit Card',
          enum: ['Credit Card', 'Debit Card', 'Cash', 'Bank Transfer'],
        },
      },
      required: ['paymentMethod'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice payment method has been successfully updated.',
    type: Invoice,
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  updatePaymentMethod(
    @Param('id', ParseIntPipe) id: number,
    @Body('paymentMethod') paymentMethod: string,
  ) {
    return this.invoiceService.updatePaymentMethod(id, paymentMethod);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancel an invoice',
    description:
      'Cancel an invoice and revert all associated sessions back to pending status. This will delete the invoice and all its items, and update session statuses.',
  })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Invoice has been successfully cancelled.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Invoice cancelled successfully' },
        updatedSessions: { type: 'number', example: 2 },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({
    status: 400,
    description: 'Invoice cannot be cancelled (already has receipt)',
  })
  cancelInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.invoiceService.cancelInvoice(id);
  }

  @Patch(':id/confirm-payment')
  @ApiOperation({
    summary: 'Confirm payment for an invoice',
    description:
      'Confirms payment for an invoice in a single transaction. This will: 1) Update payment method if provided, 2) Mark all associated sessions/courseplus/packages as paid, 3) Create a receipt, 4) Mark invoice as receipt done. All operations are atomic.',
  })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({
    description: 'Payment confirmation payload',
    schema: {
      type: 'object',
      properties: {
        paymentMethod: {
          type: 'string',
          description: 'Payment method to update (optional)',
          example: 'Credit Card',
          enum: ['Credit Card', 'Debit Card', 'Cash', 'Bank Transfer'],
        },
        receiptDate: {
          type: 'string',
          description:
            'Receipt date in YYYY-MM-DD format (optional, defaults to today)',
          example: '2025-08-24',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Payment has been successfully confirmed.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Payment confirmed successfully' },
        updatedSessions: { type: 'number', example: 2 },
        receiptId: { type: 'number', example: 123 },
        invoice: { type: 'object', description: 'Updated invoice object' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({
    status: 400,
    description:
      'Invoice cannot be confirmed (already has receipt or other validation error)',
  })
  confirmPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { paymentMethod?: string; receiptDate?: string },
  ) {
    return this.invoiceService.confirmPayment(id, body);
  }
}
