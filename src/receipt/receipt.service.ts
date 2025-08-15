import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Receipt } from './entities/receipt.entity';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { ReceiptFilterDto } from './dto/receipt-filter.dto';
import { InvoiceService } from '../invoice/invoice.service';

@Injectable()
export class ReceiptService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    private readonly invoiceService: InvoiceService,
  ) {}

  async create(createReceiptDto: CreateReceiptDto): Promise<Receipt> {
    // Verify invoice exists
    const invoice = await this.invoiceService.findOne(
      createReceiptDto.invoiceId,
    );

    if (invoice.receiptDone) {
      throw new BadRequestException(
        'Receipt has already been generated for this invoice',
      );
    }

    // Create receipt
    const receipt = this.receiptRepository.create({
      ...createReceiptDto,
      date: new Date(createReceiptDto.date),
    });

    const savedReceipt = await this.receiptRepository.save(receipt);

    // Mark invoice as receipt done
    await this.invoiceService.markReceiptDone(createReceiptDto.invoiceId);

    return this.findOne(savedReceipt.id);
  }

  async findAll(filterDto: ReceiptFilterDto): Promise<{
    receipts: Receipt[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const {
      page = 1,
      limit = 10,
      from,
      to,
      invoiceId,
      receiptNumber,
    } = filterDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.receiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.invoice', 'invoice');

    // Apply filters
    if (from) {
      queryBuilder.andWhere('receipt.date >= :from', { from });
    }

    if (to) {
      queryBuilder.andWhere('receipt.date <= :to', { to });
    }

    if (invoiceId) {
      queryBuilder.andWhere('receipt.invoiceId = :invoiceId', { invoiceId });
    }

    if (receiptNumber) {
      queryBuilder.andWhere('receipt.id::text ILIKE :receiptNumber', {
        receiptNumber: `%${receiptNumber}%`,
      });
    }

    // Get total count
    const totalCount = await queryBuilder.getCount();

    // Apply pagination and ordering
    const receipts = await queryBuilder
      .orderBy('receipt.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const totalPages = Math.ceil(totalCount / limit);

    return {
      receipts,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: number): Promise<Receipt> {
    const receipt = await this.receiptRepository.findOne({
      where: { id },
      relations: ['invoice'],
    });

    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${id} not found`);
    }

    return receipt;
  }

  async remove(id: number): Promise<void> {
    const receipt = await this.findOne(id);
    await this.receiptRepository.remove(receipt);
  }
}
