import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceiptService } from './receipt.service';
import { ReceiptController } from './receipt.controller';
import { Receipt } from './entities/receipt.entity';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Receipt]),
    InvoiceModule, // Import InvoiceModule to access InvoiceService
  ],
  controllers: [ReceiptController],
  providers: [ReceiptService],
  exports: [ReceiptService, TypeOrmModule],
})
export class ReceiptModule {}
