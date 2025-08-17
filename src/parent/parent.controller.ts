import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ParentService } from './parent.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ParentEntity } from './entities/parent.entity';
import { CreateParentDto } from './dto/create-parent.dto';
import { PaginatedParentResponseDto } from './dto/paginated-parent-response.dto';
import { AssignChildrenToParentDto } from './dto/assign-children-parent.dto';
import { ConnectParentStudentDto } from './dto/connect-parent-student.dto';
import { PaginatedParentChildrenResponseDto } from './dto/paginated-parent-children-response.dto';
import { ParentStudentEntity } from './entities/parent-student.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Parents')
@Controller('parents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.REGISTRAR)
@ApiBearerAuth('JWT-auth')
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @Get()
  @ApiOperation({ summary: 'Get all parents' })
  @ApiResponse({
    status: 200,
    description: 'Returns all parents',
    type: [ParentEntity],
  })
  findAllParents() {
    return this.parentService.findAllParents();
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search parents by name with pagination and child filtering',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Search query for parent name',
  })
  @ApiQuery({
    name: 'child',
    required: false,
    description: 'Filter by child name',
  })
  @ApiQuery({
    name: 'address',
    required: false,
    description: 'Filter by parent address',
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
  @ApiResponse({
    status: 200,
    description: 'Returns parents that match the search query with pagination',
    type: PaginatedParentResponseDto,
  })
  searchParentsByName(
    @Query('query') query?: string,
    @Query('child') child?: string,
    @Query('address') address?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.parentService.searchParentsByName(
      query,
      child,
      address,
      page,
      limit,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a new parent' })
  @ApiBody({ type: CreateParentDto })
  @ApiResponse({
    status: 201,
    description: 'Parent has been successfully created',
    type: ParentEntity,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  createParent(@Body() createParentDto: CreateParentDto) {
    console.log(createParentDto);
    return this.parentService.createParent(createParentDto);
  }

  @Post(':parentId/children')
  @ApiOperation({ summary: 'Assign children to a parent' })
  @ApiParam({
    name: 'parentId',
    type: Number,
    description: 'ID of the parent',
  })
  @ApiBody({ type: AssignChildrenToParentDto })
  @ApiResponse({
    status: 201,
    description: 'Children successfully assigned',
  })
  assignChildrenToParent(
    @Param('parentId', ParseIntPipe) parentId: number,
    @Body() dto: AssignChildrenToParentDto,
  ) {
    return this.parentService.assignChildrenToParent(parentId, dto.studentIds);
  }

  @Get(':parentId/children')
  @ApiOperation({
    summary: 'Get parent children with filtering and pagination',
  })
  @ApiParam({
    name: 'parentId',
    type: Number,
    description: 'ID of the parent',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    type: 'string',
    description: 'Search query for filtering children by name',
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
    description: 'Paginated list of parent children with filtering',
    type: PaginatedParentChildrenResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Parent not found' })
  getParentChildren(
    @Param('parentId', ParseIntPipe) parentId: number,
    @Query('query') query?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number = 12,
  ) {
    return this.parentService.getParentChildren(parentId, query, page, limit);
  }

  @Post('connections')
  @ApiOperation({ summary: 'Connect a parent to a student' })
  @ApiBody({ type: ConnectParentStudentDto })
  @ApiResponse({
    status: 201,
    description: 'Parent and student successfully connected',
    type: ParentStudentEntity,
  })
  @ApiResponse({
    status: 400,
    description: 'Connection already exists or invalid data',
  })
  @ApiResponse({ status: 404, description: 'Parent or student not found' })
  connectParentToStudent(@Body() connectDto: ConnectParentStudentDto) {
    return this.parentService.connectParentToStudent(
      connectDto.parentId,
      connectDto.studentId,
      connectDto.isPrimary,
    );
  }

  @Get('by-student/:studentId')
  @ApiOperation({ summary: 'Get all parents of a student' })
  @ApiParam({
    name: 'studentId',
    type: Number,
    description: 'ID of the student',
  })
  @ApiResponse({
    status: 200,
    description: 'List of parents for the student',
    type: [ParentEntity],
  })
  getParentsByStudent(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.parentService.getParentsByStudentId(studentId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a parent by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Parent ID' })
  @ApiBody({ type: CreateParentDto })
  @ApiResponse({
    status: 200,
    description: 'Parent has been successfully updated',
    type: ParentEntity,
  })
  @ApiResponse({ status: 404, description: 'Parent not found' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async updateParentById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateParentDto: Partial<CreateParentDto> = {},
  ) {
    const parent = await this.parentService.updateParent(id, updateParentDto);
    if (!parent) {
      throw new NotFoundException(`Parent with ID ${id} not found`);
    }
    return parent;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a parent by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Parent ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the parent object',
    type: ParentEntity,
  })
  @ApiResponse({ status: 404, description: 'Parent not found' })
  async findParentById(@Param('id', ParseIntPipe) id: number) {
    const parent = await this.parentService.findParentById(id);
    if (!parent) {
      throw new NotFoundException(`Parent with ID ${id} not found`);
    }
    return parent;
  }
}
