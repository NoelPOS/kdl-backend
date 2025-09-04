import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../user/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateRegistrarDto } from './dto/create-registrar.dto';
import { UpdateRegistrarDto } from './dto/update-registrar.dto';
import { PaginatedRegistrarResponseDto } from './dto/paginated-registrar-response.dto';
import { RegistrarResponseDto } from './dto/registrar-response.dto';

@Injectable()
export class RegistrarService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  private mapUserToRegistrarResponse(user: UserEntity): RegistrarResponseDto {
    return {
      id: user.id,
      name: user.userName,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profilePicture: user.profilePicture || '',
      profileKey: user.profileKey || '',
    };
  }

  async createRegistrar(createRegistrarDto: CreateRegistrarDto): Promise<RegistrarResponseDto> {
    try {
      // Check if email already exists
      const existingUser = await this.userRepository.findOne({
        where: { email: createRegistrarDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(createRegistrarDto.password, saltRounds);

      // Create new registrar with REGISTRAR role
      const registrar = this.userRepository.create({
        userName: createRegistrarDto.name, // Map name to userName
        email: createRegistrarDto.email,
        password: hashedPassword,
        role: UserRole.REGISTRAR,
        profilePicture: createRegistrarDto.profilePicture || '',
        profileKey: createRegistrarDto.profileKey || null,
      });

      const savedRegistrar = await this.userRepository.save(registrar);
      return this.mapUserToRegistrarResponse(savedRegistrar);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create registrar');
    }
  }

  async findAllRegistrars(
    query?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedRegistrarResponseDto> {
    try {
      const skip = (page - 1) * limit;
      
      let whereCondition: any = { role: UserRole.REGISTRAR };
      // If query is provided and not "All" (case-insensitive), apply name filter
      if (query && query.toLowerCase() !== 'all') {
        whereCondition.userName = Like(`%${query}%`);
      }

      const [users, totalCount] = await this.userRepository.findAndCount({
        where: whereCondition,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
        select: ['id', 'userName', 'email', 'role', 'createdAt', 'updatedAt', 'profilePicture', 'profileKey'],
      });

      const registrars = users.map(user => this.mapUserToRegistrarResponse(user));

      const totalPages = Math.ceil(totalCount / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        registrars,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch registrars');
    }
  }

  async searchRegistrars(query: string): Promise<RegistrarResponseDto[]> {
    try {
      let whereCondition: any = { role: UserRole.REGISTRAR };
      
      // If query is "All" (case-insensitive), return all registrars
      if (query.toLowerCase() !== 'all') {
        whereCondition.userName = Like(`%${query}%`);
      }

      const users = await this.userRepository.find({
        where: whereCondition,
        order: { userName: 'ASC' },
        select: ['id', 'userName', 'email', 'role', 'createdAt', 'updatedAt', 'profilePicture', 'profileKey'],
      });

      return users.map(user => this.mapUserToRegistrarResponse(user));
    } catch (error) {
      throw new InternalServerErrorException('Failed to search registrars');
    }
  }

  async getAllRegistrars(): Promise<RegistrarResponseDto[]> {
    try {
      const users = await this.userRepository.find({
        where: { role: UserRole.REGISTRAR },
        order: { userName: 'ASC' },
        select: ['id', 'userName', 'email', 'role', 'createdAt', 'updatedAt', 'profilePicture', 'profileKey'],
      });

      return users.map(user => this.mapUserToRegistrarResponse(user));
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch all registrars');
    }
  }

  async findRegistrarById(id: number): Promise<RegistrarResponseDto> {
    try {
      const user = await this.userRepository.findOne({
        where: { id, role: UserRole.REGISTRAR },
        select: ['id', 'userName', 'email', 'role', 'createdAt', 'updatedAt', 'profilePicture', 'profileKey'],
      });

      if (!user) {
        throw new NotFoundException(`Registrar with ID ${id} not found`);
      }

      return this.mapUserToRegistrarResponse(user);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch registrar');
    }
  }

  async findRegistrarByEmail(email: string): Promise<RegistrarResponseDto | null> {
    try {
      const user = await this.userRepository.findOne({
        where: { email, role: UserRole.REGISTRAR },
        select: ['id', 'userName', 'email', 'role', 'createdAt', 'updatedAt', 'profilePicture', 'profileKey'],
      });

      return user ? this.mapUserToRegistrarResponse(user) : null;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch registrar by email');
    }
  }

  async updateRegistrar(
    id: number,
    updateRegistrarDto: UpdateRegistrarDto,
  ): Promise<RegistrarResponseDto> {
    try {
      const registrar = await this.findRegistrarById(id);

      // Check if email is being updated and if it already exists
      if (updateRegistrarDto.email && updateRegistrarDto.email !== registrar.email) {
        const existingUser = await this.userRepository.findOne({
          where: { email: updateRegistrarDto.email },
        });

        if (existingUser) {
          throw new ConflictException('Email already exists');
        }
      }

      // Map name to userName if provided
      const updateData: any = { ...updateRegistrarDto };
      if (updateRegistrarDto.name) {
        updateData.userName = updateRegistrarDto.name;
        delete updateData.name;
      }

      // Handle profile fields
      if (updateRegistrarDto.profilePicture !== undefined) {
        updateData.profilePicture = updateRegistrarDto.profilePicture;
      }
      if (updateRegistrarDto.profileKey !== undefined) {
        updateData.profileKey = updateRegistrarDto.profileKey;
      }

      // Update registrar
      await this.userRepository.update(id, updateData);

      return await this.findRegistrarById(id);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update registrar');
    }
  }

  async deleteRegistrar(id: number): Promise<void> {
    try {
      const user = await this.userRepository.findOne({
        where: { id, role: UserRole.REGISTRAR },
      });

      if (!user) {
        throw new NotFoundException(`Registrar with ID ${id} not found`);
      }

      await this.userRepository.remove(user);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete registrar');
    }
  }
}