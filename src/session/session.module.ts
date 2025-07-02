import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Session,
  ClassOption,
  InvoiceItem,
  Receipt,
  Invoice,
} from './entities/session.entity';
import { Schedule } from '../schedule/entities/schedule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Session,
      Schedule,
      ClassOption,
      InvoiceItem,
      Receipt,
      Invoice,
    ]),
  ],
  controllers: [SessionController],
  providers: [SessionService],
})
export class SessionModule {}
