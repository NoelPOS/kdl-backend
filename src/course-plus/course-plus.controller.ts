import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
} from '@nestjs/swagger';

@ApiTags('CoursePlus')
@Controller('course-plus')
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

  @Patch(':id')
  @ApiOperation({ summary: 'Update a CoursePlus by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateCoursePlusDto })
  @ApiResponse({
    status: 200,
    description: 'The CoursePlus has been successfully updated.',
  })
  update(
    @Param('id') id: string,
    @Body() updateCoursePlusDto: UpdateCoursePlusDto,
  ) {
    return this.coursePlusService.update(+id, updateCoursePlusDto);
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
