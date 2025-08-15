import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike } from 'typeorm';
import { ParentEntity } from './entities/parent.entity';
import { ParentStudentEntity } from './entities/parent-student.entity';
import { StudentEntity } from '../student/entities/student.entity';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { ConnectParentStudentDto } from './dto/connect-parent-student.dto';
import { PaginatedParentResponseDto } from './dto/paginated-parent-response.dto';
import { PaginatedParentChildrenResponseDto } from './dto/paginated-parent-children-response.dto';

@Injectable()
export class ParentService {
  constructor(
    @InjectRepository(ParentEntity)
    private readonly parentRepository: Repository<ParentEntity>,
    @InjectRepository(ParentStudentEntity)
    private readonly parentStudentRepo: Repository<ParentStudentEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepository: Repository<StudentEntity>,
  ) {}

  async findAllParents(
    page: number = 1,
    limit: number = 10,
    query?: string,
    childQuery?: string,
  ): Promise<PaginatedParentResponseDto> {
    // Build the query builder
    const queryBuilder = this.parentRepository
      .createQueryBuilder('parent')
      .leftJoinAndSelect('parent.parentStudents', 'ps')
      .leftJoinAndSelect('ps.student', 'student');

    // Add parent name filtering if query is provided
    if (query && query.trim()) {
      queryBuilder.andWhere('parent.name ILIKE :query', {
        query: `%${query}%`,
      });
    }

    // Add child name filtering if childQuery is provided
    if (childQuery && childQuery.trim()) {
      queryBuilder.andWhere('student.name ILIKE :childQuery', {
        childQuery: `%${childQuery}%`,
      });
    }

    // Get total count for pagination
    const totalCount = await queryBuilder.getCount();
    const totalPages = Math.ceil(totalCount / limit);

    // Apply pagination and ordering
    const parents = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('parent.createdAt', 'DESC')
      .getMany();

    return {
      parents: parents,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async searchParentsByName(
    query?: string,
    child?: string,
    address?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedParentResponseDto> {
    try {
      // Validate pagination parameters
      page = Math.max(1, page);
      limit = Math.min(Math.max(1, limit), 100); // Max 100 items per page

      let filteredParentIds: number[] | null = null;

      // Handle child filtering
      if (child && child.trim() !== 'all') {
        const studentEntity = await this.studentRepository.findOne({
          where: { name: ILike(`%${child}%`) },
          select: ['id'],
        });

        if (studentEntity) {
          const parentChildren = await this.parentStudentRepo.find({
            where: { studentId: studentEntity.id },
          });
          filteredParentIds = parentChildren.map((pc) => pc.parentId);
        } else {
          return {
            parents: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalCount: 0,
              hasNext: false,
              hasPrev: false,
            },
          };
        }
      }

      // Build where clause
      const where: any = {};

      if (query) {
        where.name = ILike(`%${query}%`);
      }

      if (address && address.trim() !== 'all') {
        where.address = ILike(`%${address}%`);
      }

      if (filteredParentIds !== null) {
        if (filteredParentIds.length === 0) {
          return {
            parents: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalCount: 0,
              hasNext: false,
              hasPrev: false,
            },
          };
        }
        where.id = In(filteredParentIds);
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get total count
      const totalCount = await this.parentRepository.count({ where });
      const totalPages = Math.ceil(totalCount / limit);

      // Fetch paginated parents
      const parents = await this.parentRepository.find({
        where,
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });

      return {
        parents,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to search parents: ' + error.message,
      );
    }
  }

  async createParent(createParentDto: CreateParentDto): Promise<ParentEntity> {
    try {
      const parent = new ParentEntity();
      parent.name = createParentDto.name;
      parent.email = createParentDto.email;
      parent.contactNo = createParentDto.contactNo;
      parent.lineId = createParentDto.lineId;
      parent.address = createParentDto.address;
      parent.profilePicture = createParentDto.profilePicture || '';
      parent.profileKey = createParentDto.profileKey || '';
      const savedParent = await this.parentRepository.save(parent);
      return savedParent;
    } catch (error) {
      throw new BadRequestException(
        'Failed to create parent: ' + error.message,
      );
    }
  }

  async assignChildrenToParent(
    parentId: number,
    studentIds: number[],
  ): Promise<ParentStudentEntity[]> {
    const assignments = studentIds.map((studentId) => {
      const entry = new ParentStudentEntity();
      entry.parentId = parentId;
      entry.studentId = studentId;
      return entry;
    });

    return this.parentStudentRepo.save(assignments);
  }

  async connectParentToStudent(
    parentId: number,
    studentId: number,
    isPrimary: boolean = false,
  ): Promise<ParentStudentEntity> {
    // Check if connection already exists
    const existingConnection = await this.parentStudentRepo.findOne({
      where: { parentId, studentId },
    });

    if (existingConnection) {
      throw new BadRequestException('Parent and student are already connected');
    }

    // Verify parent and student exist
    const parent = await this.parentRepository.findOne({
      where: { id: parentId },
    });
    if (!parent) {
      throw new NotFoundException(`Parent with ID ${parentId} not found`);
    }

    const student = await this.studentRepository.findOne({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    const connection = new ParentStudentEntity();
    connection.parentId = parentId;
    connection.studentId = studentId;
    connection.isPrimary = isPrimary;

    return this.parentStudentRepo.save(connection);
  }

  async getParentChildren(
    parentId: number,
    query?: string,
    page: number = 1,
    limit: number = 12,
  ): Promise<PaginatedParentChildrenResponseDto> {
    // Verify parent exists
    const parent = await this.parentRepository.findOne({
      where: { id: parentId },
    });
    if (!parent) {
      throw new NotFoundException(`Parent with ID ${parentId} not found`);
    }

    const queryBuilder = this.parentStudentRepo
      .createQueryBuilder('ps')
      .leftJoinAndSelect('ps.student', 'student')
      .where('ps.parentId = :parentId', { parentId });

    // Add search filtering if query is provided
    if (query && query.trim()) {
      queryBuilder.andWhere('student.name ILIKE :query', {
        query: `%${query}%`,
      });
    }

    // Get total count for pagination
    const totalCount = await queryBuilder.getCount();
    const totalPages = Math.ceil(totalCount / limit);

    // Apply pagination
    const children = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('ps.isPrimary', 'DESC') // Primary connections first
      .addOrderBy('student.name', 'ASC')
      .getMany();

    // Transform the result to match the frontend interface
    const transformedChildren = children.map((ps) => ({
      id: ps.id,
      parentId: ps.parentId,
      studentId: ps.studentId,
      isPrimary: ps.isPrimary,
      student: ps.student,
    }));

    return {
      children: transformedChildren,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getChildrenByParentId(parentId: number): Promise<StudentEntity[]> {
    const parentStudents = await this.parentStudentRepo.find({
      where: { parentId },
    });

    if (parentStudents.length === 0) {
      return [];
    }

    const studentIds = parentStudents.map((ps) => ps.studentId);
    return this.studentRepository.find({
      where: { id: In(studentIds) },
    });
  }

  async getParentsByStudentId(studentId: number): Promise<ParentEntity[]> {
    const parentStudents = await this.parentStudentRepo.find({
      where: { studentId },
    });

    if (parentStudents.length === 0) {
      return [];
    }

    const parentIds = parentStudents.map((ps) => ps.parentId);
    return this.parentRepository.find({
      where: { id: In(parentIds) },
    });
  }

  async findParentById(id: number): Promise<ParentEntity> {
    try {
      const parent = await this.parentRepository.findOneBy({ id });
      if (!parent) {
        throw new NotFoundException(`Parent with ID ${id} not found`);
      }
      console.log('Found parent:', parent);
      return parent;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to find parent with ID ${id}: ${error.message}`,
      );
    }
  }

  async updateParent(
    id: number,
    updateParentDto: UpdateParentDto,
  ): Promise<ParentEntity> {
    try {
      const parent = await this.parentRepository.findOneBy({ id });
      if (!parent) {
        throw new NotFoundException(`Parent with ID ${id} not found`);
      }
      Object.assign(parent, updateParentDto);
      const updatedParent = await this.parentRepository.save(parent);
      return updatedParent;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update parent with ID ${id}: ${error.message}`,
      );
    }
  }
}
