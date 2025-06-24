import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DiscountEntity } from './entities/discount.entity';
import { Repository } from 'typeorm';

@Injectable()
export class DiscountService {
  constructor(
    @InjectRepository(DiscountEntity)
    private readonly discountRepository: Repository<DiscountEntity>,
  ) {}

  create(createDiscountDto: CreateDiscountDto): Promise<DiscountEntity> {
    const discount = this.discountRepository.create(createDiscountDto);
    return this.discountRepository.save(discount);
  }

  findAll(): Promise<DiscountEntity[]> {
    return this.discountRepository.find();
  }

  async findOne(id: number): Promise<DiscountEntity> {
    const discount = await this.discountRepository.findOne({ where: { id } });
    if (!discount) {
      throw new NotFoundException(`Discount with ID ${id} not found.`);
    }
    return discount;
  }

  async update(id: number, updateDiscountDto: UpdateDiscountDto): Promise<DiscountEntity> {
    await this.discountRepository.update(id, updateDiscountDto);
    const updatedDiscount = await this.findOne(id);
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
