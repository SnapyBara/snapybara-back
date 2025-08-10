import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { NotFoundException } from '@nestjs/common';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let model: Model<NotificationDocument>;

  const mockNotification = {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    type: 'achievement',
    title: 'New Achievement!',
    message: 'You earned a new achievement',
    data: { achievementId: 'achievement-123' },
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
  };

  const mockNotificationModel = jest.fn().mockImplementation((dto) => ({
    ...dto,
    save: jest.fn().mockResolvedValue({ ...mockNotification, ...dto }),
  })) as any;

  mockNotificationModel.create = jest.fn();
  mockNotificationModel.find = jest.fn();
  mockNotificationModel.findOne = jest.fn();
  mockNotificationModel.findById = jest.fn();
  mockNotificationModel.findByIdAndUpdate = jest.fn();
  mockNotificationModel.findByIdAndDelete = jest.fn();
  mockNotificationModel.updateMany = jest.fn();
  mockNotificationModel.deleteMany = jest.fn();
  mockNotificationModel.deleteOne = jest.fn();
  mockNotificationModel.countDocuments = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getModelToken(Notification.name),
          useValue: mockNotificationModel,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    model = module.get<Model<NotificationDocument>>(getModelToken(Notification.name));
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification', async () => {
      const userId = new Types.ObjectId();
      const notificationData = {
        userId: userId.toString(),
        type: 'achievement',
        title: 'New Achievement!',
        message: 'You earned a new achievement',
        data: { achievementId: 'achievement-123' },
      };

      const result = await service.create(notificationData);

      expect(mockNotificationModel).toHaveBeenCalledWith({
        ...notificationData,
        userId: expect.any(Types.ObjectId),
      });
      expect(result).toHaveProperty('title', notificationData.title);
    });
  });

  describe('findByUser', () => {
    it('should find notifications for a user with pagination', async () => {
      const userId = new Types.ObjectId().toString();
      const filters = { page: 1, limit: 10 };
      const notifications = [mockNotification, mockNotification];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(notifications),
      };

      mockNotificationModel.find.mockReturnValue(mockQuery);
      mockNotificationModel.countDocuments
        .mockResolvedValueOnce(2) // total
        .mockResolvedValueOnce(1); // unread

      const result = await service.findByUser(userId, filters);

      expect(mockNotificationModel.find).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId),
      });
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: notifications,
        total: 2,
        unreadCount: 1,
        page: 1,
        limit: 10,
      });
    });

    it('should filter notifications by type and read status', async () => {
      const userId = new Types.ObjectId().toString();
      const filters = { isRead: false, type: 'achievement' };

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockNotificationModel.find.mockReturnValue(mockQuery);
      mockNotificationModel.countDocuments.mockResolvedValue(0);

      await service.findByUser(userId, filters);

      expect(mockNotificationModel.find).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId),
        isRead: false,
        type: 'achievement',
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notificationId = mockNotification._id.toString();
      const userId = new Types.ObjectId().toString();
      
      const notificationWithSave = {
        ...mockNotification,
        save: jest.fn().mockResolvedValue({
          ...mockNotification,
          isRead: true,
          readAt: new Date(),
        }),
      };

      mockNotificationModel.findOne.mockResolvedValue(notificationWithSave);

      const result = await service.markAsRead(notificationId, userId);

      expect(mockNotificationModel.findOne).toHaveBeenCalledWith({
        _id: expect.any(Types.ObjectId),
        userId: expect.any(Types.ObjectId),
      });
      expect(notificationWithSave.save).toHaveBeenCalled();
      expect(result.isRead).toBe(true);
    });

    it('should throw NotFoundException if notification not found', async () => {
      const notificationId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      
      mockNotificationModel.findOne.mockResolvedValue(null);

      await expect(
        service.markAsRead(notificationId, userId)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a user', async () => {
      const userId = new Types.ObjectId().toString();
      mockNotificationModel.updateMany.mockResolvedValue({ modifiedCount: 5 });

      const result = await service.markAllAsRead(userId);

      expect(mockNotificationModel.updateMany).toHaveBeenCalledWith(
        { userId: expect.any(Types.ObjectId), isRead: false },
        { isRead: true, readAt: expect.any(Date) }
      );
      expect(result).toEqual({ modifiedCount: 5 });
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification', async () => {
      const notificationId = mockNotification._id.toString();
      const userId = new Types.ObjectId().toString();
      
      mockNotificationModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await service.deleteNotification(notificationId, userId);

      expect(mockNotificationModel.deleteOne).toHaveBeenCalledWith({
        _id: expect.any(Types.ObjectId),
        userId: expect.any(Types.ObjectId),
      });
    });

    it('should throw NotFoundException if notification not found', async () => {
      const notificationId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      
      mockNotificationModel.deleteOne.mockResolvedValue({ deletedCount: 0 });

      await expect(
        service.deleteNotification(notificationId, userId)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearOldNotifications', () => {
    it('should delete old read notifications', async () => {
      const userId = new Types.ObjectId().toString();
      mockNotificationModel.deleteMany.mockResolvedValue({ deletedCount: 10 });

      const result = await service.clearOldNotifications(userId);

      expect(mockNotificationModel.deleteMany).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId),
        createdAt: { $lt: expect.any(Date) },
        isRead: true,
      });
      expect(result).toEqual({ deletedCount: 10 });
    });
  });

  describe('notification helper methods', () => {
    it('should create photo liked notification', async () => {
      const ownerId = new Types.ObjectId().toString();
      const likerId = new Types.ObjectId().toString();
      const photoId = new Types.ObjectId().toString();
      
      await service.notifyPhotoLiked(ownerId, likerId, photoId);

      expect(mockNotificationModel).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Types.ObjectId),
          type: 'photo_liked',
          title: 'Your photo was liked!',
          data: {
            entityType: 'photo',
            entityId: photoId,
            fromUserId: likerId,
          },
        })
      );
    });

    it('should create new review notification', async () => {
      const ownerId = new Types.ObjectId().toString();
      const reviewerId = new Types.ObjectId().toString();
      const pointId = new Types.ObjectId().toString();
      
      await service.notifyNewReview(ownerId, reviewerId, pointId);

      expect(mockNotificationModel).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Types.ObjectId),
          type: 'review_on_point',
          title: 'New review on your point',
          data: {
            entityType: 'point',
            entityId: pointId,
            fromUserId: reviewerId,
          },
        })
      );
    });

    it('should create achievement earned notification', async () => {
      const userId = new Types.ObjectId().toString();
      
      await service.notifyAchievementEarned(userId, 'First Photo', 50);

      expect(mockNotificationModel).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Types.ObjectId),
          type: 'achievement_earned',
          title: 'Achievement Unlocked!',
          message: 'You earned the "First Photo" achievement and 50 points!',
          priority: 'high',
        })
      );
    });
  });
});
