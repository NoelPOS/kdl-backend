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
import { CoursePlus } from '../course-plus/entities/course-plus.entity';
import { PackageEntity } from '../package/entities/package.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Session,
      Schedule,
      ClassOption,
      InvoiceItem,
      Receipt,
      Invoice,
      CoursePlus,
      PackageEntity,
    ]),
  ],
  controllers: [SessionController],
  providers: [SessionService],
})
export class SessionModule {}
