import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomEntity } from './entities/room.entity';

@Module({
  controllers: [RoomController],
  providers: [RoomService],
  imports: [
    TypeOrmModule.forFeature([RoomEntity])
  ]
})
export class RoomModule {}
