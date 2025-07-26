import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DiscountEntity } from './entities/discount.entity';
import { ILike, Repository } from 'typeorm';

@Injectable()
export class DiscountService {
  constructor(
    @InjectRepository(DiscountEntity)
    private readonly discountRepository: Repository<DiscountEntity>,
  ) {}

  async create(createDiscountDto: CreateDiscountDto): Promise<DiscountEntity> {
    const { title, usage, amount } = createDiscountDto;

    const now = new Date();

    // Optimized query using query builder with composite index
    const existing = await this.discountRepository
      .createQueryBuilder('discount')
      .where('discount.title = :title', { title })
      .andWhere('discount.effective_end_date IS NULL')
      .getOne();

    if (existing) {
      existing.effective_end_date = new Date(now.getTime() - 1000); // expire 1 second before new one
      await this.discountRepository.save(existing);
    }

    const newDiscount = this.discountRepository.create({
      title,
      usage,
      amount,
      effective_start_date: now,
      effective_end_date: null,
    });

    return this.discountRepository.save(newDiscount);
  }

  async findAll(): Promise<DiscountEntity[]> {
    return this.discountRepository
      .createQueryBuilder('discount')
      .where('discount.effective_end_date IS NULL')
      .orderBy('discount.title', 'ASC')
      .getMany();
  }

  async findOne(name: string): Promise<DiscountEntity[]> {
    console.log('Finding discount with name: ', name);

    // Optimized query using query builder for better performance with ILIKE
    const discount = await this.discountRepository
      .createQueryBuilder('discount')
      .where('discount.title ILIKE :name', { name: `%${name}%` })
      .andWhere('discount.effective_end_date IS NULL') // Only search active discounts
      .getOne();

    if (!discount) {
      throw new NotFoundException(`Discount with name ${name} not found.`);
    }
    return [discount];
  }

  async update(
    id: number,
    updateDiscountDto: UpdateDiscountDto,
  ): Promise<DiscountEntity> {
    await this.discountRepository.update(id, updateDiscountDto);
    const updatedDiscount = await this.discountRepository.findOne({
      where: { id },
    });
    if (!updatedDiscount) {
      throw new NotFoundException(`Discount with ID ${id} not found.`);
    }
    return updatedDiscount;
  }

  async remove(id: number): Promise<{ message: string }> {
    const result = await this.discountRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Discount with ID ${id} not found.`);
    }
    return { message: `Successfully deleted discount with ID ${id}` };
  }
}
