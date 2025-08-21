import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { DiscountService } from './discount.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DiscountEntity } from './entities/discount.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Discounts')
@Controller('discounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.REGISTRAR)
@ApiBearerAuth('JWT-auth')
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new discount' })
  @ApiBody({ type: CreateDiscountDto })
  @ApiResponse({
    status: 201,
    description: 'The discount has been successfully created.',
    type: DiscountEntity,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  create(@Body() createDiscountDto: CreateDiscountDto) {
    return this.discountService.create(createDiscountDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all discounts' })
  @ApiResponse({
    status: 200,
    description: 'Returns all discounts',
    type: [DiscountEntity],
  })
  findAll() {
    return this.discountService.findAll();
  }

  @Get('search/:name')
  @ApiOperation({ summary: 'Get a discount by name' })
  @ApiParam({ name: 'name', description: 'The name of the discount' })
  @ApiResponse({
    status: 200,
    description: 'Returns the discount with the specified name',
    type: DiscountEntity,
  })
  @ApiResponse({ status: 404, description: 'Discount not found' })
  findOne(@Param('name') name: string) {
    return this.discountService.findOne(name);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a discount' })
  @ApiParam({ name: 'id', description: 'The ID of the discount' })
  @ApiBody({ type: UpdateDiscountDto })
  @ApiResponse({
    status: 200,
    description: 'The discount has been successfully updated.',
    type: DiscountEntity,
  })
  @ApiResponse({ status: 404, description: 'Discount not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDiscountDto: UpdateDiscountDto,
  ) {
    return this.discountService.update(id, updateDiscountDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a discount' })
  @ApiParam({ name: 'id', description: 'The ID of the discount' })
  @ApiResponse({
    status: 200,
    description: 'The discount has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Discount not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.discountService.remove(id);
  }
}
