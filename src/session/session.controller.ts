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
} from '@nestjs/swagger';
import { Session } from './entities/session.entity';

@ApiTags('Sessions')
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

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

  @Get('overview/:studentId')
  @ApiOperation({ summary: "Get a student's session overview" })
  @ApiParam({ name: 'studentId', type: 'number' })
  @ApiResponse({ status: 200, description: "The student's session overview" })
  getStudentSessionOverview(
    @Param('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.sessionService.getSessionOverviewByStudentId(studentId);
  }

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
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSessionDto: UpdateSessionDto,
  ) {
    return this.sessionService.update(id, updateSessionDto);
  }

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
