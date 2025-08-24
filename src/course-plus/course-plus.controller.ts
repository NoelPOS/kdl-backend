import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CoursePlusService } from './course-plus.service';
import { CreateCoursePlusDto } from './dto/create-course-plus.dto';
import { UpdateCoursePlusDto } from './dto/update-course-plus.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('CoursePlus')
@Controller('course-plus')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.REGISTRAR)
@ApiBearerAuth('JWT-auth')
export class CoursePlusController {
  constructor(private readonly coursePlusService: CoursePlusService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new CoursePlus and associated schedules' })
  @ApiBody({ type: CreateCoursePlusDto })
  @ApiResponse({
    status: 201,
    description: 'The CoursePlus and schedules have been successfully created.',
  })
  async create(@Body() createCoursePlusDto: CreateCoursePlusDto) {
    return await this.coursePlusService.create(createCoursePlusDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all CoursePlus records' })
  @ApiResponse({ status: 200, description: 'List of all CoursePlus records' })
  findAll() {
    return this.coursePlusService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a CoursePlus by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'The found CoursePlus' })
  findOne(@Param('id') id: string) {
    return this.coursePlusService.findOne(+id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update CoursePlus payment status' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({
    description: 'Payment status update payload',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Payment status for the course plus',
          enum: ['paid', 'unpaid'],
          example: 'paid',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'The CoursePlus payment status has been successfully updated.',
  })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.coursePlusService.updateStatus(+id, status);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update CoursePlus attributes (unified endpoint)',
    description:
      'Update CoursePlus payment status and invoiceGenerated. Used by frontend for unified course plus updates.',
  })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({
    description: 'Update payload with support for multiple attributes',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Payment status for the course plus',
          enum: ['paid', 'unpaid'],
          example: 'paid',
        },
        payment: {
          type: 'string',
          description: 'Payment status (alias for status field)',
          enum: ['paid', 'unpaid'],
          example: 'paid',
        },
        invoiceDone: {
          type: 'boolean',
          description: 'Whether invoice is generated for the course plus',
          example: true,
        },
        invoiceGenerated: {
          type: 'boolean',
          description: 'Whether invoice is generated (alias for invoiceDone)',
          example: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'The CoursePlus has been successfully updated.',
  })
  async update(
    @Param('id') id: string,
    @Body()
    updateData: {
      status?: string;
      payment?: string;
      invoiceDone?: boolean;
      invoiceGenerated?: boolean;
    },
  ) {
    // Map payment to status for compatibility
    if (updateData.payment && !updateData.status) {
      updateData.status = updateData.payment;
    }

    // Map invoiceDone to invoiceGenerated for compatibility
    if (
      updateData.invoiceDone !== undefined &&
      updateData.invoiceGenerated === undefined
    ) {
      updateData.invoiceGenerated = updateData.invoiceDone;
    }

    return this.coursePlusService.updateMultipleFields(+id, updateData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a CoursePlus by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'The CoursePlus has been successfully deleted.',
  })
  remove(@Param('id') id: string) {
    return this.coursePlusService.remove(+id);
  }
}
