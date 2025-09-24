import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Patch,
  Delete,
  ParseIntPipe,
  NotFoundException,
  Query,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import { RegistrarService } from './registrar.service';
import { CreateRegistrarDto } from './dto/create-registrar.dto';
import { UpdateRegistrarDto } from './dto/update-registrar.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RegistrarResponseDto } from './dto/registrar-response.dto';
import { PaginatedRegistrarResponseDto } from './dto/paginated-registrar-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('registrars')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
export class RegistrarController {
  constructor(private readonly registrarService: RegistrarService) {}

  @ApiTags('Registrars')
  @Post()
  @ApiOperation({ summary: 'Create a new registrar' })
  @ApiBody({ type: CreateRegistrarDto })
  @ApiResponse({
    status: 201,
    description: 'Registrar has been successfully created',
    type: RegistrarResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  createRegistrar(@Body() createRegistrarDto: CreateRegistrarDto) {
    return this.registrarService.createRegistrar(createRegistrarDto);
  }

  @ApiTags('Registrars')
  @Get()
  @ApiOperation({ summary: 'Get registrars by name query parameter' })
  @ApiQuery({
    name: 'name',
    required: false,
    type: 'string',
    description: 'Search query for registrar name',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns registrars that match the search query',
    type: [RegistrarResponseDto],
  })
  searchRegistrarsByName(@Query('name') name?: string) {
    if (name) {
      return this.registrarService.searchRegistrars(name);
    }
    return this.registrarService.getAllRegistrars();
  }

  @ApiTags('Registrars')
  @Get('search')
  @ApiOperation({ summary: 'Search registrars with pagination and filtering' })
  @ApiQuery({
    name: 'query',
    required: false,
    type: 'string',
    description: 'Search query for registrar name',
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
    description: 'Returns paginated registrars with filtering',
    type: PaginatedRegistrarResponseDto,
  })
  findAllRegistrars(
    @Query('query') query?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.registrarService.findAllRegistrars(query, page, limit);
  }

  @ApiTags('Registrars')
  @Get('all')
  @ApiOperation({ summary: 'Get all registrars without pagination' })
  @ApiResponse({
    status: 200,
    description: 'Returns all registrars',
    type: [RegistrarResponseDto],
  })
  getAllRegistrars() {
    return this.registrarService.getAllRegistrars();
  }

  @ApiTags('Registrars')
  @Get(':id')
  @ApiOperation({ summary: 'Get a registrar by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Registrar ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the registrar object',
    type: RegistrarResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Registrar not found' })
  async findRegistrarById(@Param('id', ParseIntPipe) id: number) {
    const registrar = await this.registrarService.findRegistrarById(id);
    if (!registrar) {
      throw new NotFoundException(`Registrar with ID ${id} not found`);
    }
    return registrar;
  }

  @ApiTags('Registrars')
  @Put(':id')
  @ApiOperation({ summary: 'Update a registrar by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Registrar ID' })
  @ApiBody({ type: UpdateRegistrarDto })
  @ApiResponse({
    status: 200,
    description: 'Registrar has been successfully updated',
    type: RegistrarResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Registrar not found' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async updateRegistrarById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRegistrarDto: UpdateRegistrarDto,
  ) {
    const registrar = await this.registrarService.updateRegistrar(
      id,
      updateRegistrarDto,
    );
    if (!registrar) {
      throw new NotFoundException(`Registrar with ID ${id} not found`);
    }
    return registrar;
  }

  @ApiTags('Registrars')
  @Patch(':id/role')
  @ApiOperation({ summary: 'Update registrar role by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Registrar ID' })
  @ApiBody({ type: UpdateRoleDto })
  @ApiResponse({
    status: 200,
    description: 'Registrar role has been successfully updated',
    type: RegistrarResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Registrar not found' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async updateRegistrarRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    const registrar = await this.registrarService.updateRegistrar(id, { role: updateRoleDto.role });
    return registrar;
  }

  @ApiTags('Registrars')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a registrar by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Registrar ID' })
  @ApiResponse({
    status: 204,
    description: 'Registrar has been successfully deleted',
  })
  @ApiResponse({ status: 404, description: 'Registrar not found' })
  async deleteRegistrar(@Param('id', ParseIntPipe) id: number) {
    await this.registrarService.deleteRegistrar(id);
  }
}