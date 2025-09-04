import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegistrarController } from './registrar.controller';
import { RegistrarService } from './registrar.service';
import { UserEntity } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [RegistrarController],
  providers: [RegistrarService],
  exports: [RegistrarService],
})
export class RegistrarModule {}
