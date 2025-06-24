import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { Schedule } from 'src/schedule/entities/schedule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Session, Schedule])],
  controllers: [SessionController],
  providers: [SessionService],
})
export class SessionModule {}
