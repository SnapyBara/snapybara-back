import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(notificationData: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: any;
    priority?: string;
    expiresAt?: Date;
  }): Promise<Notification> {
    const notification = new this.notificationModel({
      ...notificationData,
      userId: new Types.ObjectId(notificationData.userId),
    });
    return notification.save();
  }

  async findByUser(
    userId: string,
    filters?: {
      isRead?: boolean;
      type?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    data: Notification[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...queryFilters } = filters || {};
    const skip = (page - 1) * limit;

    const query: any = { userId: new Types.ObjectId(userId) };

    if (queryFilters.isRead !== undefined) {
      query.isRead = queryFilters.isRead;
    }

    if (queryFilters.type) {
      query.type = queryFilters.type;
    }

    const [data, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(query),
      this.notificationModel.countDocuments({
        userId: new Types.ObjectId(userId),
        isRead: false,
      }),
    ]);

    return { data, total, unreadCount, page, limit };
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification> {
    const notification = await this.notificationModel.findOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isRead = true;
    notification.readAt = new Date();
    return notification.save();
  }

  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { modifiedCount: result.modifiedCount };
  }

  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.notificationModel.deleteOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Notification not found');
    }
  }

  async clearOldNotifications(
    userId: string,
    daysToKeep: number = 30,
  ): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.notificationModel.deleteMany({
      userId: new Types.ObjectId(userId),
      createdAt: { $lt: cutoffDate },
      isRead: true,
    });

    return { deletedCount: result.deletedCount };
  }

  // Helper methods for creating specific notification types
  async notifyPhotoLiked(
    photoOwnerId: string,
    likedByUserId: string,
    photoId: string,
  ): Promise<void> {
    await this.create({
      userId: photoOwnerId,
      type: 'photo_liked',
      title: 'Your photo was liked!',
      message: 'Someone liked your photo',
      data: {
        entityType: 'photo',
        entityId: photoId,
        fromUserId: likedByUserId,
      },
    });
  }

  async notifyNewReview(
    pointOwnerId: string,
    reviewerId: string,
    pointId: string,
  ): Promise<void> {
    await this.create({
      userId: pointOwnerId,
      type: 'review_on_point',
      title: 'New review on your point',
      message: 'Someone reviewed your point of interest',
      data: {
        entityType: 'point',
        entityId: pointId,
        fromUserId: reviewerId,
      },
    });
  }

  async notifyAchievementEarned(
    userId: string,
    achievementName: string,
    points: number,
  ): Promise<void> {
    await this.create({
      userId,
      type: 'achievement_earned',
      title: 'Achievement Unlocked!',
      message: `You earned the "${achievementName}" achievement and ${points} points!`,
      data: {
        achievementName,
        points,
      },
      priority: 'high',
    });
  }
}
