import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoursePackage } from './entities/course-package.entity';
import { CreateCoursePackageDto } from './dto/create-course-package.dto';
import { UpdateCoursePackageDto } from './dto/update-course-package.dto';

@Injectable()
export class CoursePackageService {
  constructor(
    @InjectRepository(CoursePackage)
    private readonly repo: Repository<CoursePackage>,
  ) {}

  async findAll(): Promise<CoursePackage[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<CoursePackage> {
    const pkg = await this.repo.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException(`Course package with ID ${id} not found`);
    return pkg;
  }

  async create(dto: CreateCoursePackageDto): Promise<CoursePackage> {
    const pkg = this.repo.create(dto);
    return this.repo.save(pkg);
  }

  async update(id: number, dto: UpdateCoursePackageDto): Promise<CoursePackage> {
    await this.findOne(id); // throws if not found
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id); // throws if not found
    await this.repo.delete(id);
  }
}
