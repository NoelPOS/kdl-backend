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
  Put,
} from '@nestjs/common';
import { PackageService } from './package.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { PackagePurchaseRequestDto } from './dto/package-purchase-request.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { PaginatedPackageResponseDto } from './dto/paginated-package-response.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { PackageEntity } from './entities/package.entity';

@ApiTags('Packages')
@Controller('packages')
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new package' })
  @ApiBody({ type: PackagePurchaseRequestDto })
  @ApiResponse({
    status: 201,
    description: 'The package has been successfully created.',
    type: PackageEntity,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  create(@Body() packagePurchaseRequest: PackagePurchaseRequestDto) {
    return this.packageService.create(packagePurchaseRequest);
  }

  @Get()
  @ApiOperation({ summary: 'Get all packages' })
  @ApiResponse({
    status: 200,
    description: 'Returns all packages',
    type: [PackageEntity],
  })
  findAll() {
    return this.packageService.findAll();
  }

  @Get('filter')
  @ApiOperation({
    summary:
      'Filter packages by status, class mode, and student name with pagination',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Status to filter by, or "all" for any',
  })
  @ApiQuery({
    name: 'classMode',
    required: false,
    description: 'Class mode to filter by, or "all" for any',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Student name to search for (partial match)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns packages matching the filter with pagination',
    type: PaginatedPackageResponseDto,
  })
  filter(
    @Query('status') status?: string,
    @Query('classMode') classMode?: string,
    @Query('query') query?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    console.log(query, status, classMode, page, limit);
    return this.packageService.filter(status, classMode, query, page, limit);
  }

  @Get('my-packages/:studentId')
  @ApiOperation({
    summary: 'Get packages for a specific student with pagination',
  })
  @ApiParam({ name: 'studentId', description: 'The ID of the student' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns packages for the student with pagination',
    type: PaginatedPackageResponseDto,
  })
  getMyPackages(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.packageService.getMyPackages(studentId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a package by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the package' })
  @ApiResponse({
    status: 200,
    description: 'Returns the package with the specified ID',
    type: PackageEntity,
  })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const packageEntity = await this.packageService.findOne(id);
    if (!packageEntity) {
      throw new NotFoundException(`Package with ID ${id} not found.`);
    }
    return packageEntity;
  }

  @Put(':id/apply')
  @ApiOperation({
    summary: 'Apply a package to a course (mark as used/redeemed)',
  })
  @ApiParam({ name: 'id', description: 'The ID of the package to apply' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        courseId: {
          type: 'number',
          description: 'The ID of the course to apply the package to',
        },
        courseName: { type: 'string', description: 'The name of the course' },
        status: {
          type: 'string',
          enum: ['used'],
          description: 'Package status (should be "used")',
        },
        isRedeemed: {
          type: 'boolean',
          description: 'Whether the package is redeemed',
        },
        redeemedAt: {
          type: 'string',
          format: 'date-time',
          description: 'When the package was redeemed',
        },
        redeemedCourseId: {
          type: 'number',
          description: 'The ID of the course the package was redeemed for',
        },
        redeemedCourseName: {
          type: 'string',
          description: 'The name of the course the package was redeemed for',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'When the package was last updated',
        },
      },
      required: ['courseId', 'courseName'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'The package has been successfully applied to the course.',
    type: PackageEntity,
  })
  @ApiResponse({ status: 404, description: 'Package not found' })
  @ApiResponse({
    status: 400,
    description: 'Package is already redeemed or invalid data',
  })
  async applyPackage(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    applyPackageDto: {
      courseId: number;
      courseName: string;
      status?: string;
      isRedeemed?: boolean;
      redeemedAt?: string;
      redeemedCourseId?: number;
      redeemedCourseName?: string;
      updatedAt?: string;
    },
  ) {
    return this.packageService.applyPackage(id, applyPackageDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a package' })
  @ApiParam({ name: 'id', description: 'The ID of the package' })
  @ApiBody({ type: UpdatePackageDto })
  @ApiResponse({
    status: 200,
    description: 'The package has been successfully updated.',
    type: PackageEntity,
  })
  @ApiResponse({ status: 404, description: 'Package not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePackageDto: UpdatePackageDto,
  ) {
    return this.packageService.update(id, updatePackageDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a package' })
  @ApiParam({ name: 'id', description: 'The ID of the package' })
  @ApiResponse({
    status: 200,
    description: 'The package has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Package not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.packageService.remove(id);
  }
}
