import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassOptionService } from './class-option.service';
import { ClassOptionController } from './class-option.controller';
import { ClassOption } from './entities/class-option.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClassOption])],
  controllers: [ClassOptionController],
  providers: [ClassOptionService],
  exports: [ClassOptionService, TypeOrmModule],
})
export class ClassOptionModule {}
