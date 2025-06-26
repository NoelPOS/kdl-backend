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
} from '@nestjs/common';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { CourseEntity } from './entities/course.entity';

@ApiTags('Courses')
@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new course' })
  @ApiBody({ type: CreateCourseDto })
  @ApiResponse({
    status: 201,
    description: 'The course has been successfully created.',
    type: CourseEntity,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  create(@Body() createCourseDto: CreateCourseDto) {
    return this.courseService.create(createCourseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all courses' })
  @ApiResponse({
    status: 200,
    description: 'Returns all courses',
    type: [CourseEntity],
  })
  findAll() {
    return this.courseService.findAll();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search for courses by name' })
  @ApiQuery({
    name: 'name',
    description: 'The name of the course to search for',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns courses matching the search term',
    type: [CourseEntity],
  })
  search(@Query('name') name: string) {
    return this.courseService.search(name);
  }

  @Get('filter')
  @ApiOperation({ summary: 'Filter courses by age range and medium' })
  @ApiQuery({
    name: 'ageRange',
    required: true,
    description: 'Age range to filter by, or "all" for any',
  })
  @ApiQuery({
    name: 'medium',
    required: true,
    description: 'Medium to filter by, or "all" for any',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns courses matching the filter',
    type: [CourseEntity],
  })
  filter(@Query('ageRange') ageRange: string, @Query('medium') medium: string) {
    return this.courseService.filter(ageRange, medium);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a course by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the course' })
  @ApiResponse({
    status: 200,
    description: 'Returns the course with the specified ID',
    type: CourseEntity,
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const course = await this.courseService.findOne(id);
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found.`);
    }
    return course;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a course' })
  @ApiParam({ name: 'id', description: 'The ID of the course' })
  @ApiBody({ type: UpdateCourseDto })
  @ApiResponse({
    status: 200,
    description: 'The course has been successfully updated.',
    type: CourseEntity,
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCourseDto: UpdateCourseDto,
  ) {
    return this.courseService.update(id, updateCourseDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a course' })
  @ApiParam({ name: 'id', description: 'The ID of the course' })
  @ApiResponse({
    status: 200,
    description: 'The course has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.courseService.remove(id);
  }
}
