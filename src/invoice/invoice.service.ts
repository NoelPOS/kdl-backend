import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, ILike } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { DocumentCounter } from './entities/document-counter.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceFilterDto } from './dto/invoice-filter.dto';
import { PaginatedInvoiceResponseDto } from './dto/paginated-invoice-response.dto';
// Import entities that need to be updated after invoice creation
import { Session } from '../session/entities/session.entity';
import { CoursePlus } from '../course-plus/entities/course-plus.entity';
import { PackageEntity } from '../package/entities/package.entity';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,

    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,

    @InjectRepository(DocumentCounter)
    private readonly documentCounterRepository: Repository<DocumentCounter>,

    private readonly dataSource: DataSource,
  ) {}

  async generateDocumentId(): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const yearMonthDay = dateStr.replace(/-/g, ''); // YYYYMMDD format

      // Try to find existing counter for today
      let counter = await manager.getRepository(DocumentCounter).findOne({
        where: { date: dateStr },
      });

      if (!counter) {
        // Create new counter for today
        counter = manager.getRepository(DocumentCounter).create({
          date: dateStr,
          counter: 1,
        });
      } else {
        // Increment existing counter
        counter.counter += 1;
      }

      // Save the updated counter
      await manager.getRepository(DocumentCounter).save(counter);

      // Generate document ID: YYYYMMDDXXXX (where XXXX is 4-digit counter)
      const documentId = `${yearMonthDay}${counter.counter.toString().padStart(4, '0')}`;

      return documentId;
    });
  }

  async getNextDocumentId(): Promise<string> {
    // Preview next document ID without incrementing counter
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const yearMonthDay = dateStr.replace(/-/g, ''); // YYYYMMDD format

    const counter = await this.documentCounterRepository.findOne({
      where: { date: dateStr },
    });

    const nextCounter = counter ? counter.counter + 1 : 1;
    const documentId = `${yearMonthDay}${nextCounter.toString().padStart(4, '0')}`;

    return documentId;
  }

  async create(createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      // Generate document ID if not provided
      const documentId =
        createInvoiceDto.documentId || (await this.generateDocumentId());

      // Extract items from DTO to avoid cascade save duplication
      const { items, ...invoiceData } = createInvoiceDto;

      // Create the invoice (without items to avoid cascade duplication)
      const invoice = manager.getRepository(Invoice).create({
        ...invoiceData,
        documentId,
        date: new Date(createInvoiceDto.date),
      });

      const savedInvoice = await manager.getRepository(Invoice).save(invoice);

      // Create invoice items
      const invoiceItems = items.map((item) =>
        manager.getRepository(InvoiceItem).create({
          ...item,
          invoiceId: savedInvoice.id,
        }),
      );

      console.log('invoice items to save:', invoiceItems);

      await manager.getRepository(InvoiceItem).save(invoiceItems);

      // CRITICAL: Update the status of all related entities based on sessionGroups
      // This was missing and is why sessions weren't being marked as invoiceDone!
      if (
        createInvoiceDto.sessionGroups &&
        createInvoiceDto.sessionGroups.length > 0
      ) {
        for (const sessionGroup of createInvoiceDto.sessionGroups) {
          const { transactionType, actualId } = sessionGroup;

          if (transactionType === 'course') {
            const sessionRepo = manager.getRepository(Session);
            await sessionRepo.update(parseInt(actualId), { invoiceDone: true });
          } else if (transactionType === 'courseplus') {
            const coursePlusRepo = manager.getRepository(CoursePlus);
            // Remove 'cp-' prefix if it exists
            const coursePlusId = actualId.startsWith('cp-')
              ? parseInt(actualId.replace('cp-', ''))
              : parseInt(actualId);
            await coursePlusRepo.update(coursePlusId, {
              invoiceGenerated: true,
            });
          } else if (transactionType === 'package') {
            const packageRepo = manager.getRepository(PackageEntity);
            // Remove 'pkg-' prefix if it exists
            const packageId = actualId.startsWith('pkg-')
              ? parseInt(actualId.replace('pkg-', ''))
              : parseInt(actualId);
            await packageRepo.update(packageId, { invoiceGenerated: true });
          }
        }
      }

      // Return invoice with items
      return manager.getRepository(Invoice).findOne({
        where: { id: savedInvoice.id },
        relations: ['items'],
      });
    });
  }

  async findAll(
    filterDto: InvoiceFilterDto,
  ): Promise<PaginatedInvoiceResponseDto> {
    const {
      page = 1,
      limit = 10,
      documentId,
      courseName,
      receiptDone,
    } = filterDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'items');

    // Apply filters
    if (documentId) {
      queryBuilder.andWhere('invoice.documentId ILIKE :documentId', {
        documentId: `%${documentId}%`,
      });
    }

    if (courseName) {
      queryBuilder.andWhere('invoice.courseName ILIKE :courseName', {
        courseName: `%${courseName}%`,
      });
    }

    if (receiptDone !== undefined) {
      if (receiptDone === 'completed') {
        queryBuilder.andWhere('invoice.receiptDone = :receiptDone', {
          receiptDone: true,
        });
      } else if (receiptDone === 'pending') {
        queryBuilder.andWhere('invoice.receiptDone = :receiptDone', {
          receiptDone: false,
        });
      }
      // For 'all' or any other value, don't add a filter (show all records)
    }

    // Get total count
    const totalCount = await queryBuilder.getCount();

    // Apply pagination and ordering
    const invoices = await queryBuilder
      .orderBy('invoice.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const totalPages = Math.ceil(totalCount / limit);

    return {
      invoices,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: number): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return invoice;
  }

  async markReceiptDone(id: number): Promise<Invoice> {
    const invoice = await this.findOne(id);
    invoice.receiptDone = true;
    return await this.invoiceRepository.save(invoice);
  }
}
