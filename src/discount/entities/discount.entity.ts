import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('discounts')
export class DiscountEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  usage: string;

  @Column()
  amount: number;

  @Column()
  effective_start_date: Date;

  @Column({ nullable: true })
  effective_end_date: Date;
}
