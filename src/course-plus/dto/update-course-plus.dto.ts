import { PartialType } from '@nestjs/swagger';
import { CreateCoursePlusDto } from './create-course-plus.dto';

export class UpdateCoursePlusDto extends PartialType(CreateCoursePlusDto) {}
