import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreatePackageDto } from './dto/create-package.dto';
import { PackagePurchaseRequestDto } from './dto/package-purchase-request.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { PackageEntity } from './entities/package.entity';

@Injectable()
export class PackageService {
  constructor(
    @InjectRepository(PackageEntity)
    private readonly packageRepository: Repository<PackageEntity>,
  ) {}

  async create(packagePurchaseRequest: PackagePurchaseRequestDto) {
    // Create the package entity with the DTO data and set default values
    const packageData = {
      ...packagePurchaseRequest,
      purchaseDate: new Date(), // Set current date as YYYY-MM-DD
      status: 'not_used' as const,
      isRedeemed: false,
    };

    const packageEntity = this.packageRepository.create(packageData);
    return this.packageRepository.save(packageEntity);
  }

  async findAll() {
    return this.packageRepository.find();
  }

  async findOne(id: number) {
    return this.packageRepository.findOne({ where: { id } });
  }

  async update(id: number, updatePackageDto: UpdatePackageDto) {
    await this.packageRepository.update(id, updatePackageDto);
    return this.findOne(id);
  }

  async remove(id: number) {
    const packageEntity = await this.findOne(id);
    if (!packageEntity) {
      return null;
    }
    await this.packageRepository.remove(packageEntity);
    return packageEntity;
  }

  async filter(
    status?: string,
    classMode?: string,
    query?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    packages: PackageEntity[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    // Validate pagination parameters
    page = Math.max(1, page);
    limit = Math.min(Math.max(1, limit), 100); // Max 100 items per page

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (classMode && classMode !== 'all') {
      where.classMode = classMode;
    }
    if (query && query.trim() !== '') {
      where.studentName = ILike(`%${query}%`);
    }

    // Calculate pagination values
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalCount = await this.packageRepository.count({ where });

    // Get paginated results
    const packages = await this.packageRepository.find({
      where,
      skip,
      take: limit,
      order: { id: 'DESC' }, // Latest packages first
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      packages,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext,
        hasPrev,
      },
    };
  }

  async getMyPackages(studentId: number, page: number = 1, limit: number = 10) {
    // Validate pagination parameters
    page = Math.max(1, page);
    limit = Math.min(Math.max(1, limit), 100);

    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalCount = await this.packageRepository.count({
      where: { studentId },
    });

    // Get paginated results
    const packages = await this.packageRepository.find({
      where: { studentId },
      skip,
      take: limit,
      order: { id: 'DESC' },
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      packages,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext,
        hasPrev,
      },
    };
  }

  async applyPackage(
    id: number,
    applyPackageDto: {
      courseId: number;
      courseName: string;
      status?: string;
      isRedeemed?: boolean;
      redeemedAt?: string;
      redeemedCourseId?: number;
      redeemedCourseName?: string;
      updatedAt?: string;
    },
  ) {
    // Find the package
    const packageEntity = await this.findOne(id);
    if (!packageEntity) {
      throw new NotFoundException(`Package with ID ${id} not found.`);
    }

    // Check if package is already redeemed
    if (packageEntity.isRedeemed) {
      throw new BadRequestException(
        'Package is already redeemed and cannot be applied again.',
      );
    }

    // Prepare update data
    const updateData = {
      status: 'used' as const,
      isRedeemed: true,
      redeemedAt: applyPackageDto.redeemedAt || new Date().toISOString(),
      redeemedCourseId: applyPackageDto.courseId,
      redeemedCourseName: applyPackageDto.courseName,
      updatedAt: new Date(),
    };

    // Update the package
    await this.packageRepository.update(id, updateData);

    // Return the updated package
    return this.findOne(id);
  }
}
