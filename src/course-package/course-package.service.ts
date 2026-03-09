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
    return this.repo.find({ order: { effectiveStartDate: 'DESC' } });
  }

  async findOne(id: number): Promise<CoursePackage> {
    const pkg = await this.repo.findOne({ where: { id } });
    if (!pkg)
      throw new NotFoundException(`Course package with ID ${id} not found`);
    return pkg;
  }

  async create(dto: CreateCoursePackageDto): Promise<CoursePackage> {
    // Soft versioning: if there's an active package with the same name,
    // auto-expire it the day before the new one starts.
    const existingActive = await this.repo
      .createQueryBuilder('cp')
      .where('LOWER(cp.name) = LOWER(:name)', { name: dto.name })
      .andWhere('cp.effectiveEndDate IS NULL')
      .getOne();

    if (existingActive) {
      const newStart = new Date(dto.effectiveStartDate);
      const expiryDate = new Date(newStart);
      expiryDate.setDate(expiryDate.getDate() - 1);
      await this.repo.update(existingActive.id, {
        effectiveEndDate: expiryDate,
      });
    }

    const pkg = this.repo.create({
      name: dto.name,
      numberOfCourses: dto.numberOfCourses,
      effectiveStartDate: new Date(dto.effectiveStartDate),
      effectiveEndDate: dto.effectiveEndDate
        ? new Date(dto.effectiveEndDate)
        : null,
    });
    return this.repo.save(pkg);
  }

  // Only allows setting effectiveEndDate — name/numberOfCourses are immutable.
  async update(
    id: number,
    dto: UpdateCoursePackageDto,
  ): Promise<CoursePackage> {
    await this.findOne(id); // throws if not found
    if (dto.effectiveEndDate !== undefined) {
      await this.repo.update(id, {
        effectiveEndDate: new Date(dto.effectiveEndDate),
      });
    }
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const pkg = await this.findOne(id); // throws if not found
    await this.repo.delete(pkg.id);
  }
}
