import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReceiptService } from './receipt.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { ReceiptFilterDto } from './dto/receipt-filter.dto';
import { Receipt } from './entities/receipt.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('receipts')
@ApiTags('Receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.REGISTRAR)
@ApiBearerAuth('JWT-auth')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new receipt and mark invoice as receipt done',
  })
  @ApiBody({ type: CreateReceiptDto })
  @ApiResponse({
    status: 201,
    description:
      'The receipt has been successfully created and invoice marked as receipt done.',
    type: Receipt,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Invoice not found.' })
  create(@Body() createReceiptDto: CreateReceiptDto) {
    return this.receiptService.create(createReceiptDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all receipts (paginated, filterable)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated, filterable list of receipts',
  })
  findAll(@Query() filterDto: ReceiptFilterDto) {
    return this.receiptService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a receipt by ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'The found receipt',
    type: Receipt,
  })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.receiptService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a receipt' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'The receipt has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.receiptService.remove(id);
  }
}
