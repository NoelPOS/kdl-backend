import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('discounts')
export class DiscountEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  amount: number;
}