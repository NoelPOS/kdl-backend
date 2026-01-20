import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, Like } from 'typeorm';
import { ClassOption } from './entities/class-option.entity';
import { CreateClassOptionDto } from './dto/create-class-option.dto';
import { UpdateClassOptionDto } from './dto/update-class-option.dto';

@Injectable()
export class ClassOptionService {
  constructor(
    @InjectRepository(ClassOption)
    private readonly classOptionRepository: Repository<ClassOption>,
  ) {}

  async create(
    createClassOptionDto: CreateClassOptionDto,
  ): Promise<ClassOption> {
    // Check for existing active option with same classMode (case-insensitive)
    // This implements soft versioning: old records keep their pricing reference
    const existingActiveOption = await this.classOptionRepository
      .createQueryBuilder('co')
      .where('LOWER(co.classMode) = LOWER(:classMode)', {
        classMode: createClassOptionDto.classMode,
      })
      .andWhere('co.effectiveEndDate IS NULL')
      .getOne();

    if (existingActiveOption) {
      // Set expiry date to the day before new option's start date
      const newStartDate = new Date(createClassOptionDto.effectiveStartDate);
      const expiryDate = new Date(newStartDate);
      expiryDate.setDate(expiryDate.getDate() - 1);

      await this.classOptionRepository.update(existingActiveOption.id, {
        effectiveEndDate: expiryDate,
      });
    }

    const classOption = this.classOptionRepository.create({
      ...createClassOptionDto,
      effectiveStartDate: new Date(createClassOptionDto.effectiveStartDate),
      effectiveEndDate: createClassOptionDto.effectiveEndDate
        ? new Date(createClassOptionDto.effectiveEndDate)
        : null,
    });
    return await this.classOptionRepository.save(classOption);
  }

  async findAll(): Promise<ClassOption[]> {
    return await this.classOptionRepository.find({
      where: {
        classMode: Not(Like('%package%')),
      },
      order: { effectiveStartDate: 'DESC' },
    });
  }

  async findOne(id: number): Promise<ClassOption> {
    const classOption = await this.classOptionRepository.findOne({
      where: { id },
    });

    if (!classOption) {
      throw new NotFoundException(`Class option with ID ${id} not found`);
    }

    return classOption;
  }

  async update(
    id: number,
    updateClassOptionDto: UpdateClassOptionDto,
  ): Promise<ClassOption> {
    const classOption = await this.findOne(id);

    const updateData: any = { ...updateClassOptionDto };
    if (updateClassOptionDto.effectiveStartDate) {
      updateData.effectiveStartDate = new Date(
        updateClassOptionDto.effectiveStartDate,
      );
    }
    if (updateClassOptionDto.effectiveEndDate) {
      updateData.effectiveEndDate = new Date(
        updateClassOptionDto.effectiveEndDate,
      );
    }

    Object.assign(classOption, updateData);
    return await this.classOptionRepository.save(classOption);
  }

  async remove(id: number): Promise<void> {
    const classOption = await this.findOne(id);
    await this.classOptionRepository.remove(classOption);
  }
}
