import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  private readonly databaseEnabled: boolean;

  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,

    @Optional() private configService?: ConfigService,
  ) {
    this.databaseEnabled =
      this.configService?.get<boolean>('DATABASE_ENABLED', true) ?? true;
  }

  // =================================================================================================
  // User Management
  // =================================================================================================

  async create(createUserDto: CreateUserDto): Promise<UserEntity> {
    const { password, ...userData } = createUserDto;
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = this.userRepository.create({
      ...userData,
      password: hashedPassword,
    });

    return await this.userRepository.save(user);
  }

  async findAll(paginationDto?: PaginationDto): Promise<UserEntity[]> {
    const { limit = 10, page = 1 } = paginationDto || {};
    const skip = (page - 1) * limit;

    return this.userRepository.find({
      take: limit,
      skip: skip,
      select: ['id', 'userName', 'email', 'role', 'createdAt'],
    });
  }

  async findById(id: number): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'userName', 'email', 'role', 'createdAt'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  async findByUserName(userName: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: { userName },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findById(id);

    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt();
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, salt);
    }

    Object.assign(user, updateUserDto);
    return await this.userRepository.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findById(id);
    await this.userRepository.remove(user);
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserEntity | null> {
    const user = await this.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
  }

  async verifyEmail(email: string): Promise<UserEntity> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return await this.userRepository.save(user);
  }

  async updatePassword(id: number, newPassword: string): Promise<void> {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await this.userRepository.update(id, { password: hashedPassword });
  }

  // Auth-related methods needed by AuthService
  async findOne(criteria: any): Promise<UserEntity | undefined> {
    return this.userRepository.findOne({ where: criteria });
  }

  // Refresh token methods removed
}
