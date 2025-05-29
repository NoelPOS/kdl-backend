import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '../entities/user.entity';
import { Repository, UpdateResult } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { v4 as uuid4 } from 'uuid';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EncryptionService } from '../../../common/services/encryption.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  private readonly databaseEnabled: boolean;

  constructor(
    @Optional()
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {
    this.databaseEnabled = this.configService.get<boolean>('DATABASE_ENABLED');
    console.log(`Database enabled: ${this.databaseEnabled}`);
  }

  async create(userDto: CreateUserDto): Promise<UserEntity> {
    if (!this.databaseEnabled) {
      throw new BadRequestException('Database functionality is disabled');
    }

    try {
      // Check if email already exists
      const existingUser = await this.userRepository.findOneBy({
        email: userDto.email,
      });
      //   const existingUser = await this.userRepository.findOne({
      //     where: { email: userDto.email },
      //   });
      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      const user = new UserEntity();
      user.userName = userDto.userName;
      user.email = userDto.email;
      user.apiKey = uuid4();
      const salt = await bcrypt.genSalt();
      user.password = await bcrypt.hash(userDto.password, salt);

      const savedUser = await this.userRepository.save(user);
      delete savedUser.password;
      return savedUser;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create user: ' + error.message);
    }
  }

  async findAll(paginationDto: PaginationDto): Promise<{
    items: UserEntity[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const { page = 1, pageSize = 10 } = paginationDto;
      const skip = (page - 1) * pageSize;

      const [users, total] = await this.userRepository.findAndCount({
        skip,
        take: pageSize,
        order: {
          createdAt: 'DESC',
        },
      });

      const items = users.map((user) => {
        const userCopy = { ...user };
        delete userCopy.password;
        return userCopy;
      });

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch users: ' + error.message);
    }
  }

  async findOne(data: Partial<UserEntity>): Promise<UserEntity> {
    try {
      const user = await this.userRepository.findOneBy({ email: data.email });
      if (!user) {
        throw new UnauthorizedException(
          'User not found with the provided email',
        );
      }
      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Failed to find user: ' + error.message);
    }
  }

  async findByApiKey(apiKey: string): Promise<UserEntity> {
    try {
      const user = await this.userRepository.findOneBy({ apiKey });
      if (!user) {
        throw new UnauthorizedException('Invalid API key');
      }
      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to authenticate with API key: ' + error.message,
      );
    }
  }

  async findById(id: number): Promise<UserEntity> {
    try {
      const user = await this.userRepository.findOneBy({ id });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      delete user.password;

      // Decrypt 2FA secret if it exists
      if (user.twoFASecret) {
        try {
          user.twoFASecret = this.encryptionService.decrypt(user.twoFASecret);
        } catch (error) {
          console.error('Failed to decrypt 2FA secret:', error.message);
        }
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to find user with ID ${id}: ${error.message}`,
      );
    }
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<UserEntity> {
    try {
      const user = await this.findById(id);

      if (updateUserDto.email && updateUserDto.email !== user.email) {
        const existingUser = await this.userRepository.findOneBy({
          email: updateUserDto.email,
        });
        if (existingUser) {
          throw new BadRequestException('Email is already in use');
        }
      }

      if (updateUserDto.password) {
        const salt = await bcrypt.genSalt();
        updateUserDto.password = await bcrypt.hash(
          updateUserDto.password,
          salt,
        );
      }
      const updatedUser = await this.userRepository.save({
        ...user,
        ...updateUserDto,
      });
      // Remove password from the returned user object
      delete updatedUser.password;
      return updatedUser;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update user with ID ${id}: ${error.message}`,
      );
    }
  }

  async remove(id: number): Promise<void> {
    try {
      const result = await this.userRepository.delete(id);
      if (result.affected === 0) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to delete user with ID ${id}: ${error.message}`,
      );
    }
  }

  async updateSecretKey(userId: number, secret: string): Promise<UpdateResult> {
    if (!this.databaseEnabled) {
      throw new BadRequestException('Database functionality is disabled');
    }

    try {
      // Encrypt the 2FA secret before storing it
      const encryptedSecret = this.encryptionService.encrypt(secret);

      return this.userRepository.update(
        {
          id: userId,
        },
        {
          twoFASecret: encryptedSecret,
          enable2FA: true,
        },
      );
    } catch (error) {
      throw new BadRequestException(
        `Failed to update 2FA secret: ${error.message}`,
      );
    }
  }

  async disable2FA(userId: number): Promise<UpdateResult> {
    try {
      return this.userRepository.update(
        {
          id: userId,
        },
        {
          enable2FA: false,
          twoFASecret: null,
        },
      );
    } catch (error) {
      throw new BadRequestException(`Failed to disable 2FA: ${error.message}`);
    }
  }

  async updateRefreshToken(
    userId: number,
    refreshToken: string,
  ): Promise<void> {
    try {
      // Hash the refresh token before storing
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

      await this.userRepository.update(
        { id: userId },
        { refreshToken: hashedRefreshToken },
      );
    } catch (error) {
      throw new BadRequestException(
        `Failed to update refresh token: ${error.message}`,
      );
    }
  }

  async removeRefreshToken(userId: number): Promise<void> {
    try {
      await this.userRepository.update({ id: userId }, { refreshToken: null });
    } catch (error) {
      throw new BadRequestException(
        `Failed to remove refresh token: ${error.message}`,
      );
    }
  }
}
