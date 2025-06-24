import { Module } from '@nestjs/common';
import { DiscountService } from './discount.service';
import { DiscountController } from './discount.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountEntity } from './entities/discount.entity';

@Module({
  controllers: [DiscountController],
  providers: [DiscountService],
  imports: [TypeOrmModule.forFeature([DiscountEntity])]
})
export class DiscountModule {}
