import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
import { Receipt } from '../receipt/entities/receipt.entity';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,

    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,

    @InjectRepository(DocumentCounter)
    private readonly documentCounterRepository: Repository<DocumentCounter>,

    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,

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
      const documentId = await this.generateDocumentId();

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

  async confirmPayment(
    id: number,
    options: { paymentMethod?: string; receiptDate?: string },
  ): Promise<{
    success: boolean;
    message: string;
    updatedSessions: number;
    receiptId: number;
    invoice: Invoice;
  }> {
    return this.dataSource.transaction(async (manager) => {
      // First, get the invoice with all its details
      const invoice = await manager.getRepository(Invoice).findOne({
        where: { id },
        relations: ['items'],
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${id} not found`);
      }

      // Check if invoice already has a receipt (cannot confirm payment again)
      if (invoice.receiptDone) {
        throw new BadRequestException(
          'Cannot confirm payment: Receipt has already been generated',
        );
      }

      let updatedSessionCount = 0;

      // Step 1: Update payment method if provided
      if (
        options.paymentMethod &&
        options.paymentMethod !== invoice.paymentMethod
      ) {
        const validPaymentMethods = [
          'Credit Card',
          'Debit Card',
          'Cash',
          'Bank Transfer',
        ];
        if (!validPaymentMethods.includes(options.paymentMethod)) {
          throw new BadRequestException(
            `Invalid payment method: ${options.paymentMethod}. Valid values are: ${validPaymentMethods.join(', ')}`,
          );
        }

        await manager.getRepository(Invoice).update(id, {
          paymentMethod: options.paymentMethod,
        });
      }

      // Step 2: Mark all associated sessions/courseplus/packages as paid
      if (invoice.sessionGroups && invoice.sessionGroups.length > 0) {
        for (const sessionGroup of invoice.sessionGroups) {
          const { transactionType, actualId } = sessionGroup;

          if (transactionType === 'course') {
            // Mark session as paid
            const sessionRepo = manager.getRepository(Session);
            await sessionRepo.update(parseInt(actualId), {
              payment: 'Paid',
            });
            updatedSessionCount++;
          } else if (transactionType === 'courseplus') {
            // Mark course plus as paid
            const coursePlusRepo = manager.getRepository(CoursePlus);
            const coursePlusId = actualId.startsWith('cp-')
              ? parseInt(actualId.replace('cp-', ''))
              : parseInt(actualId);
            await coursePlusRepo.update(coursePlusId, {
              status: 'paid',
            });
            updatedSessionCount++;
          }
        }
      }

      // Step 3: Create receipt
      const receiptDate = options.receiptDate
        ? new Date(options.receiptDate)
        : new Date();

      const receipt = manager.getRepository(Receipt).create({
        invoiceId: id,
        date: receiptDate,
      });
      const savedReceipt = await manager.getRepository(Receipt).save(receipt);

      // Step 4: Mark invoice as receipt done
      await manager.getRepository(Invoice).update(id, {
        receiptDone: true,
      });

      // Get the updated invoice to return
      const updatedInvoice = await manager.getRepository(Invoice).findOne({
        where: { id },
        relations: ['items'],
      });

      return {
        success: true,
        message: 'Payment confirmed successfully',
        updatedSessions: updatedSessionCount,
        receiptId: savedReceipt.id,
        invoice: updatedInvoice,
      };
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

  async updatePaymentMethod(
    id: number,
    paymentMethod: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(id);

    // Validate payment method
    const validPaymentMethods = [
      'Credit Card',
      'Debit Card',
      'Cash',
      'Bank Transfer',
    ];
    if (!validPaymentMethods.includes(paymentMethod)) {
      throw new BadRequestException(
        `Invalid payment method: ${paymentMethod}. Valid values are: ${validPaymentMethods.join(', ')}`,
      );
    }

    invoice.paymentMethod = paymentMethod;
    return await this.invoiceRepository.save(invoice);
  }

  async cancelInvoice(id: number): Promise<{
    success: boolean;
    message: string;
    updatedSessions: number;
  }> {
    return this.dataSource.transaction(async (manager) => {
      // First, get the invoice with all its details
      const invoice = await manager.getRepository(Invoice).findOne({
        where: { id },
        relations: ['items'],
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${id} not found`);
      }

      // Check if invoice already has a receipt (cannot cancel if receipt is done)
      if (invoice.receiptDone) {
        throw new BadRequestException(
          'Cannot cancel invoice: Receipt has already been generated',
        );
      }

      let updatedSessionCount = 0;

      // Revert all session statuses based on sessionGroups
      if (invoice.sessionGroups && invoice.sessionGroups.length > 0) {
        for (const sessionGroup of invoice.sessionGroups) {
          const { transactionType, actualId } = sessionGroup;

          if (transactionType === 'course') {
            // Revert session back to unpaid and invoiceDone = false
            const sessionRepo = manager.getRepository(Session);
            await sessionRepo.update(parseInt(actualId), {
              payment: 'Unpaid',
              invoiceDone: false,
            });
            updatedSessionCount++;
          } else if (transactionType === 'courseplus') {
            // Revert course plus back to unpaid and invoiceGenerated = false
            const coursePlusRepo = manager.getRepository(CoursePlus);
            const coursePlusId = actualId.startsWith('cp-')
              ? parseInt(actualId.replace('cp-', ''))
              : parseInt(actualId);
            await coursePlusRepo.update(coursePlusId, {
              status: 'unpaid',
              invoiceGenerated: false,
            });
            updatedSessionCount++;
          }
        }
      }

      // First, manually delete all invoice items
      await manager.getRepository(InvoiceItem).delete({ invoiceId: id });

      // Then delete the invoice
      await manager.getRepository(Invoice).delete({ id });

      return {
        success: true,
        message: 'Invoice cancelled successfully',
        updatedSessions: updatedSessionCount,
      };
    });
  }
}
