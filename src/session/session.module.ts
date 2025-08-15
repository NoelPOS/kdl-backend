import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { CoursePlus } from '../course-plus/entities/course-plus.entity';
import { PackageEntity } from '../package/entities/package.entity';
import { ClassOptionModule } from '../class-option/class-option.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { ReceiptModule } from '../receipt/receipt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, Schedule, CoursePlus, PackageEntity]),
    ClassOptionModule,
    InvoiceModule,
    ReceiptModule,
  ],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService, TypeOrmModule],
})
export class SessionModule {}
