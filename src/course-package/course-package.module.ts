import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursePackage } from './entities/course-package.entity';
import { CoursePackageService } from './course-package.service';
import { CoursePackageController } from './course-package.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([CoursePackage]), CommonModule],
  controllers: [CoursePackageController],
  providers: [CoursePackageService],
  exports: [CoursePackageService, TypeOrmModule],
})
export class CoursePackageModule {}
