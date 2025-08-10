import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockNotificationsService = {
    findByUser: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    clearOldNotifications: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  describe('findByUser', () => {
    it('should return user notifications', async () => {
      const mockNotifications = {
        data: [
          {
            _id: 'notif-1',
            title: 'Test notification',
            isRead: false,
          },
        ],
        total: 1,
        unreadCount: 1,
        page: 1,
        limit: 20,
      };

      mockNotificationsService.findByUser.mockResolvedValue(mockNotifications);

      const req = { user: mockUser };
      const result = await controller.findByUser(req);

      expect(service.findByUser).toHaveBeenCalledWith(mockUser.id, {});
      expect(result).toEqual(mockNotifications);
    });

    it('should pass filters to service', async () => {
      const req = { user: mockUser };
      const filters = {
        isRead: false,
        type: 'achievement',
        page: 2,
        limit: 10,
      };

      mockNotificationsService.findByUser.mockResolvedValue({ data: [], total: 0, unreadCount: 0, page: 2, limit: 10 });

      await controller.findByUser(req, filters.isRead, filters.type, filters.page, filters.limit);

      expect(service.findByUser).toHaveBeenCalledWith(mockUser.id, filters);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notificationId = 'notif-123';
      const updatedNotification = { 
        _id: notificationId, 
        isRead: true,
        readAt: new Date(),
      };

      mockNotificationsService.markAsRead.mockResolvedValue(updatedNotification);

      const req = { user: mockUser };
      const result = await controller.markAsRead(notificationId, req);

      expect(service.markAsRead).toHaveBeenCalledWith(notificationId, mockUser.id);
      expect(result).toEqual(updatedNotification);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const response = { modifiedCount: 5 };
      mockNotificationsService.markAllAsRead.mockResolvedValue(response);

      const req = { user: mockUser };
      const result = await controller.markAllAsRead(req);

      expect(service.markAllAsRead).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(response);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification', async () => {
      const notificationId = 'notif-123';
      mockNotificationsService.deleteNotification.mockResolvedValue(undefined);

      const req = { user: mockUser };
      await controller.deleteNotification(notificationId, req);

      expect(service.deleteNotification).toHaveBeenCalledWith(
        notificationId,
        mockUser.id
      );
    });
  });

  describe('clearOldNotifications', () => {
    it('should clear old notifications with default days', async () => {
      const response = { deletedCount: 10 };
      mockNotificationsService.clearOldNotifications.mockResolvedValue(response);

      const req = { user: mockUser };
      const result = await controller.clearOldNotifications(req);

      expect(service.clearOldNotifications).toHaveBeenCalledWith(
        mockUser.id,
        undefined
      );
      expect(result).toEqual(response);
    });

    it('should clear old notifications with custom days', async () => {
      const daysToKeep = 7;
      const response = { deletedCount: 5 };
      mockNotificationsService.clearOldNotifications.mockResolvedValue(response);

      const req = { user: mockUser };
      const result = await controller.clearOldNotifications(req, daysToKeep);

      expect(service.clearOldNotifications).toHaveBeenCalledWith(
        mockUser.id,
        daysToKeep
      );
      expect(result).toEqual(response);
    });
  });
});
