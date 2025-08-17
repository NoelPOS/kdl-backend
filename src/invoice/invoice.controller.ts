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
  @ApiQuery({ name: 'courseName', required: false, type: String })
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
    @Query('courseName') courseName?: string,
    @Query('receiptDone') receiptDone?: string,
  ) {
    const filterDto: InvoiceFilterDto = {
      page,
      limit,
      documentId,
      courseName,
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
}
