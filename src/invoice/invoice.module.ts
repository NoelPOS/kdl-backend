import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { DocumentCounter } from './entities/document-counter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceItem, DocumentCounter])],
  controllers: [InvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService, TypeOrmModule],
})
export class InvoiceModule {}
