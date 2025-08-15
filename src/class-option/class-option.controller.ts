import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ClassOptionService } from './class-option.service';
import { CreateClassOptionDto } from './dto/create-class-option.dto';
import { UpdateClassOptionDto } from './dto/update-class-option.dto';
import { ClassOption } from './entities/class-option.entity';

@Controller('class-options')
@ApiTags('Class Options')
export class ClassOptionController {
  constructor(private readonly classOptionService: ClassOptionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new class option' })
  @ApiBody({ type: CreateClassOptionDto })
  @ApiResponse({
    status: 201,
    description: 'The class option has been successfully created.',
    type: ClassOption,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  create(@Body() createClassOptionDto: CreateClassOptionDto) {
    return this.classOptionService.create(createClassOptionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all class options' })
  @ApiResponse({
    status: 200,
    description: 'Returns all class options',
    type: [ClassOption],
  })
  findAll() {
    return this.classOptionService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a class option by ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'The found class option',
    type: ClassOption,
  })
  @ApiResponse({ status: 404, description: 'Class option not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.classOptionService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a class option' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({ type: UpdateClassOptionDto })
  @ApiResponse({
    status: 200,
    description: 'The class option has been successfully updated.',
    type: ClassOption,
  })
  @ApiResponse({ status: 404, description: 'Class option not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClassOptionDto: UpdateClassOptionDto,
  ) {
    return this.classOptionService.update(id, updateClassOptionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a class option' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'The class option has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Class option not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.classOptionService.remove(id);
  }
}
