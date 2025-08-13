import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { StatisticsService } from './statistics.service';
import { User } from '../users/schemas/user.schema';
import { PointOfInterest } from '../points/schemas/point-of-interest.schema';
import { Photo } from '../photos/schemas/photo.schema';
import { Review } from '../reviews/schemas/review.schema';
import { Types } from 'mongoose';

describe('StatisticsService', () => {
  let service: StatisticsService;

  const mockUser = {
    _id: new Types.ObjectId(),
    username: 'testuser',
    points: 100,
    level: 5,
    photosUploaded: 20,
    profilePicture: 'avatar.jpg',
  };

  const mockUserModel = {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
  };

  const mockPointModel = {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    find: jest.fn(),
  };

  const mockPhotoModel = {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    find: jest.fn(),
  };

  const mockReviewModel = {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(PointOfInterest.name),
          useValue: mockPointModel,
        },
        {
          provide: getModelToken(Photo.name),
          useValue: mockPhotoModel,
        },
        {
          provide: getModelToken(Review.name),
          useValue: mockReviewModel,
        },
      ],
    }).compile();

    service = module.get<StatisticsService>(StatisticsService);
    jest.clearAllMocks();
  });

  describe('getGlobalStatistics', () => {
    it('should return global statistics', async () => {
      mockUserModel.countDocuments.mockResolvedValue(100);
      mockPointModel.countDocuments.mockResolvedValue(50);
      mockPhotoModel.countDocuments.mockResolvedValue(200);
      mockReviewModel.countDocuments.mockResolvedValue(75);

      // Mock aggregate responses
      mockPointModel.aggregate
        .mockResolvedValueOnce([
          { category: 'landscape', count: 20 },
          { category: 'architecture', count: 15 },
        ])
        .mockResolvedValueOnce([
          { category: 'landscape', count: 20 },
          { category: 'architecture', count: 15 },
        ]);

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockUser]),
      };
      mockUserModel.find.mockReturnValue(mockQuery);

      const result = await service.getGlobalStatistics();

      expect(result).toEqual({
        totalUsers: 100,
        totalPoints: 50,
        totalPhotos: 200,
        totalReviews: 75,
        topCategories: [
          { category: 'landscape', count: 20 },
          { category: 'architecture', count: 15 },
        ],
        mostActiveUsers: [mockUser],
        trendingPoints: [
          { category: 'landscape', count: 20 },
          { category: 'architecture', count: 15 },
        ],
      });

      expect(mockUserModel.countDocuments).toHaveBeenCalledWith({
        isActive: true,
      });
      expect(mockPointModel.countDocuments).toHaveBeenCalledWith({
        isActive: true,
        status: 'approved',
      });
      expect(mockPhotoModel.countDocuments).toHaveBeenCalledWith({
        isActive: true,
        status: 'approved',
      });
      expect(mockReviewModel.countDocuments).toHaveBeenCalledWith({
        isActive: true,
      });
    });
  });

  describe('getUserStatistics', () => {
    it('should return user statistics', async () => {
      const userId = '507f1f77bcf86cd799439011';

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockPointModel.countDocuments.mockResolvedValue(10);
      mockPhotoModel.countDocuments.mockResolvedValue(25);
      mockReviewModel.countDocuments.mockResolvedValue(15);
      mockUserModel.countDocuments.mockResolvedValue(5); // rank calculation

      mockPhotoModel.aggregate.mockResolvedValue([
        { _id: null, totalLikes: 100 },
      ]);

      // Mock recent activity queries
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };

      mockPhotoModel.find.mockReturnValue(mockQuery);
      mockReviewModel.find.mockReturnValue(mockQuery);
      mockPointModel.find.mockReturnValue(mockQuery);

      const result = await service.getUserStatistics(userId);

      expect(result).toEqual({
        totalPoints: 10,
        totalPhotos: 25,
        totalReviews: 15,
        totalLikes: 100,
        level: 5,
        points: 100,
        rank: 6,
        recentActivity: [],
      });

      expect(mockPointModel.countDocuments).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId),
        isActive: true,
      });
    });

    it('should handle user not found', async () => {
      const userId = '507f1f77bcf86cd799439011';

      mockUserModel.findById.mockResolvedValue(null);
      mockPointModel.countDocuments.mockResolvedValue(0);
      mockPhotoModel.countDocuments.mockResolvedValue(0);
      mockReviewModel.countDocuments.mockResolvedValue(0);
      mockUserModel.countDocuments.mockResolvedValue(0);

      mockPhotoModel.aggregate.mockResolvedValue([]);

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };

      mockPhotoModel.find.mockReturnValue(mockQuery);
      mockReviewModel.find.mockReturnValue(mockQuery);
      mockPointModel.find.mockReturnValue(mockQuery);

      const result = await service.getUserStatistics(userId);

      expect(result).toEqual({
        totalPoints: 0,
        totalPhotos: 0,
        totalReviews: 0,
        totalLikes: 0,
        level: 1,
        points: 0,
        rank: 1,
        recentActivity: [],
      });
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard users', async () => {
      const topUsers = Array(10).fill(mockUser);

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(topUsers),
      };

      mockUserModel.find.mockReturnValue(mockQuery);

      const result = await service.getLeaderboard(10);

      expect(mockUserModel.find).toHaveBeenCalledWith({ isActive: true });
      expect(mockQuery.sort).toHaveBeenCalledWith({ points: -1, level: -1 });
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(10);
    });
  });
});
