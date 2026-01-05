import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from './entities/notification.entity';
import { UserEntity } from '../user/entities/user.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Create a notification for a specific user
   */
  async create(
    userId: number,
    title: string,
    message: string,
    type: string,
    data?: any,
  ) {
    const notification = this.notificationRepo.create({
      userId,
      title,
      message,
      type,
      data,
      isRead: false,
    });
    return await this.notificationRepo.save(notification);
  }

  /**
   * Create notifications for all users with a specific role
   */
  async createForRole(
    role: string,
    title: string,
    message: string,
    type: string,
    data?: any,
  ) {
    // Find all users with this role
    const users = await this.userRepo.find({ where: { role: role as any } });
    
    if (users.length === 0) {
      this.logger.warn(`No users found with role ${role} to notify.`);
      return;
    }

    const notifications = users.map(user => 
      this.notificationRepo.create({
        userId: user.id,
        title,
        message,
        type,
        data,
        isRead: false,
      })
    );

    await this.notificationRepo.save(notifications);
    this.logger.log(`Created notifications for ${users.length} users with role ${role}`);
  }

  /**
   * Get notifications for a user (paginated)
   */
  /**
   * Get notifications for a user (paginated with filters)
   */
  async findAll(
    userId: number,
    page: number = 1,
    limit: number = 20,
    filters?: {
      startDate?: string;
      endDate?: string;
      type?: string;
      isRead?: boolean;
      search?: string;
    },
  ) {
    const queryBuilder = this.notificationRepo.createQueryBuilder('notification');

    queryBuilder
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters?.startDate) {
      queryBuilder.andWhere('notification.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      // Add one day to include the end date fully
      const endDate = new Date(filters.endDate);
      endDate.setDate(endDate.getDate() + 1);
      queryBuilder.andWhere('notification.createdAt < :endDate', { endDate: endDate.toISOString() });
    }

    if (filters?.type && filters.type !== 'all') {
      queryBuilder.andWhere('notification.type = :type', { type: filters.type });
    }

    if (filters?.isRead !== undefined) {
      queryBuilder.andWhere('notification.isRead = :isRead', { isRead: filters.isRead });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(notification.title ILIKE :search OR notification.message ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: number) {
    const count = await this.notificationRepo.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: number, userId: number) {
    const notification = await this.notificationRepo.findOne({
      where: { id, userId },
    });

    if (notification) {
      notification.isRead = true;
      await this.notificationRepo.save(notification);
    }
    return notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number) {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true }
    );
    return { success: true };
  }
}
