import { Test, TestingModule } from '@nestjs/testing';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

describe('StatisticsController', () => {
  let controller: StatisticsController;
  let service: StatisticsService;

  const mockStatisticsService = {
    getGlobalStatistics: jest.fn(),
    getUserStatistics: jest.fn(),
    getLeaderboard: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatisticsController],
      providers: [
        {
          provide: StatisticsService,
          useValue: mockStatisticsService,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<StatisticsController>(StatisticsController);
    service = module.get<StatisticsService>(StatisticsService);
    jest.clearAllMocks();
  });

  describe('getGlobalStatistics', () => {
    it('should return global statistics', async () => {
      const mockStats = {
        totalUsers: 100,
        totalPoints: 50,
        totalPhotos: 200,
        totalReviews: 75,
        topCategories: [],
        mostActiveUsers: [],
        trendingPoints: [],
      };

      mockStatisticsService.getGlobalStatistics.mockResolvedValue(mockStats);

      const result = await controller.getGlobalStatistics();

      expect(service.getGlobalStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('getUserStatistics', () => {
    it('should return user statistics', async () => {
      const userId = 'user-123';
      const mockStats = {
        totalPoints: 10,
        totalPhotos: 25,
        totalReviews: 15,
        totalLikes: 100,
        level: 5,
        points: 150,
        rank: 10,
        recentActivity: [],
      };

      mockStatisticsService.getUserStatistics.mockResolvedValue(mockStats);

      const result = await controller.getUserStatistics(userId);

      expect(service.getUserStatistics).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockStats);
    });
  });

  describe('getMyStatistics', () => {
    it('should return current user statistics', async () => {
      const mockUser = { id: 'user-123' };
      const mockReq = { user: mockUser };
      const mockStats = {
        totalPoints: 10,
        totalPhotos: 25,
        totalReviews: 15,
        totalLikes: 100,
        level: 5,
        points: 150,
        rank: 10,
        recentActivity: [],
      };

      mockStatisticsService.getUserStatistics.mockResolvedValue(mockStats);

      const result = await controller.getMyStatistics(mockReq);

      expect(service.getUserStatistics).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockStats);
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard with default limit', async () => {
      const mockLeaderboard = [
        { username: 'user1', points: 1000, level: 10 },
        { username: 'user2', points: 900, level: 9 },
      ];

      mockStatisticsService.getLeaderboard.mockResolvedValue(mockLeaderboard);

      const result = await controller.getLeaderboard();

      expect(service.getLeaderboard).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockLeaderboard);
    });

    it('should return leaderboard with custom limit', async () => {
      const limit = 5;
      const mockLeaderboard = Array(5).fill({ username: 'user', points: 100 });

      mockStatisticsService.getLeaderboard.mockResolvedValue(mockLeaderboard);

      const result = await controller.getLeaderboard(limit);

      expect(service.getLeaderboard).toHaveBeenCalledWith(limit);
      expect(result).toHaveLength(5);
    });
  });
});
