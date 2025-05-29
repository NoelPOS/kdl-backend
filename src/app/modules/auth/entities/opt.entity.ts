import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Relation,
} from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity';

export enum TokenType {
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
}

@Entity('tokens')
export class Token {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => UserEntity, (user) => user.tokens, { onDelete: 'CASCADE' })
  user: Relation<UserEntity>;

  @Column()
  token: string;

  @Column({
    type: 'enum',
    enum: TokenType,
  })
  type: TokenType;

  @Column()
  expireIn: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
