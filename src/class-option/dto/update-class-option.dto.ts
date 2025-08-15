import { PartialType } from '@nestjs/swagger';
import { CreateClassOptionDto } from './create-class-option.dto';

export class UpdateClassOptionDto extends PartialType(CreateClassOptionDto) {}
