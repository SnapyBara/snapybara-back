import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PointsService } from '../points/points.service';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let pointsService: PointsService;
  let mockReviewModel: any;

  const mockPointsService = {
    updatePointStatistics: jest.fn(),
  };

  beforeEach(async () => {
    mockReviewModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      aggregate: jest.fn(),
      // Constructor mock
      create: jest.fn(),
    };

    // Configure find to work both with chaining (for findAll) and without (for getPointStatistics)
    mockReviewModel.find.mockImplementation(() => {
      // Return the same mock object that has all the chain methods
      return mockReviewModel;
    });

    const mockConstructor = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ 
        ...data, 
        _id: new Types.ObjectId(),
        pointId: new Types.ObjectId(data.pointId)
      }),
    }));
    Object.assign(mockConstructor, mockReviewModel);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getModelToken('Review'),
          useValue: mockConstructor,
        },
        {
          provide: PointsService,
          useValue: mockPointsService,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    pointsService = module.get<PointsService>(PointsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a review and update point rating', async () => {
      const createReviewDto = {
        pointId: '507f1f77bcf86cd799439011',
        rating: 5,
        comment: 'Great place!',
      };

      mockReviewModel.findOne.mockResolvedValueOnce(null);

      jest.spyOn(service as any, 'getPointStatistics').mockResolvedValueOnce({
        averageRating: 4.5,
        totalReviews: 10,
        ratingDistribution: {},
      });

      const result = await service.create(createReviewDto, 'user-123');

      expect(result).toHaveProperty('_id');
      expect(result.rating).toBe(createReviewDto.rating);
      expect(result.comment).toBe(createReviewDto.comment);
      expect(result.userId).toBe('user-123');
      expect(result.pointId).toBeInstanceOf(Types.ObjectId);
      expect(result.pointId.toString()).toBe(createReviewDto.pointId);
      
      expect(mockPointsService.updatePointStatistics).toHaveBeenCalledWith(
        createReviewDto.pointId,
        { averageRating: 4.5, totalReviews: 10 }
      );
    });

    it('should throw ConflictException if user already reviewed', async () => {
      const createReviewDto = {
        pointId: '507f1f77bcf86cd799439011',
        rating: 5,
        comment: 'Great!',
      };

      mockReviewModel.findOne.mockResolvedValueOnce({ _id: 'existing-review' });

      await expect(
        service.create(createReviewDto, 'user-123')
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated reviews', async () => {
      const mockReviews = [
        { _id: '1', rating: 5, comment: 'Great!' },
        { _id: '2', rating: 4, comment: 'Good!' },
      ];

      mockReviewModel.exec.mockResolvedValueOnce(mockReviews);
      mockReviewModel.countDocuments.mockResolvedValueOnce(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toEqual({
        data: mockReviews,
        total: 2,
        page: 1,
        limit: 10,
      });
    });

    it('should filter by pointId', async () => {
      const pointId = '507f1f77bcf86cd799439011';
      const mockReviews = [
        { _id: '1', rating: 5, pointId },
      ];

      mockReviewModel.exec.mockResolvedValueOnce(mockReviews);
      mockReviewModel.countDocuments.mockResolvedValueOnce(1);

      const result = await service.findAll({ pointId, page: 1, limit: 10 });

      expect(mockReviewModel.find).toHaveBeenCalledWith({
        isActive: true,
        status: 'published',
        pointId: new Types.ObjectId(pointId),
      });
      expect(result.data).toEqual(mockReviews);
    });

    it('should filter by userId', async () => {
      const userId = 'user-123';
      const mockReviews = [
        { _id: '1', rating: 5, userId },
      ];

      mockReviewModel.exec.mockResolvedValueOnce(mockReviews);
      mockReviewModel.countDocuments.mockResolvedValueOnce(1);

      const result = await service.findAll({ userId, page: 1, limit: 10 });

      expect(mockReviewModel.find).toHaveBeenCalledWith({
        isActive: true,
        status: 'published',
        userId,
      });
      expect(result.data).toEqual(mockReviews);
    });
  });

  describe('findOne', () => {
    it('should find a review by id', async () => {
      const reviewId = new Types.ObjectId().toString();
      const mockReview = {
        _id: reviewId,
        rating: 5,
        comment: 'Excellent!',
      };

      mockReviewModel.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockReview),
      });

      const result = await service.findOne(reviewId);

      expect(result).toEqual(mockReview);
    });

    it('should throw BadRequestException for invalid ID', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if review not found', async () => {
      const reviewId = new Types.ObjectId().toString();

      mockReviewModel.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(null),
      });

      await expect(service.findOne(reviewId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a review', async () => {
      const reviewId = new Types.ObjectId().toString();
      const updateDto = {
        rating: 4,
        comment: 'Updated comment',
      };
      const mockReview = {
        _id: reviewId,
        userId: 'user-123',
        pointId: 'point-123',
      };

      mockReviewModel.findById.mockResolvedValueOnce(mockReview);
      mockReviewModel.findByIdAndUpdate.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce({
          ...mockReview,
          ...updateDto,
        }),
      });

      const result = await service.update(reviewId, updateDto, 'user-123');

      expect(result).toMatchObject({
        ...mockReview,
        ...updateDto,
      });
    });

    it('should throw error if review not found', async () => {
      const reviewId = new Types.ObjectId().toString();
      mockReviewModel.findById.mockResolvedValueOnce(null);

      await expect(
        service.update(reviewId, { rating: 5 }, 'user-123')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if user is not the owner', async () => {
      const reviewId = new Types.ObjectId().toString();
      const mockReview = {
        _id: reviewId,
        userId: 'other-user',
      };

      mockReviewModel.findById.mockResolvedValueOnce(mockReview);

      await expect(
        service.update(reviewId, { rating: 5 }, 'user-123')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a review', async () => {
      const reviewId = new Types.ObjectId().toString();
      const mockReview = {
        _id: reviewId,
        userId: 'user-123',
        pointId: 'point-123',
      };

      mockReviewModel.findById.mockResolvedValueOnce(mockReview);
      mockReviewModel.findByIdAndUpdate.mockResolvedValueOnce({});

      await service.remove(reviewId, 'user-123');

      expect(mockReviewModel.findByIdAndUpdate).toHaveBeenCalledWith(reviewId, {
        isActive: false,
        updatedAt: expect.any(Date),
      });
    });

    it('should throw error if user is not the owner', async () => {
      const reviewId = new Types.ObjectId().toString();
      const mockReview = {
        _id: reviewId,
        userId: 'other-user',
      };

      mockReviewModel.findById.mockResolvedValueOnce(mockReview);

      await expect(
        service.remove(reviewId, 'user-123')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('toggleHelpful', () => {
    it('should mark review as helpful', async () => {
      const reviewId = new Types.ObjectId().toString();
      const userId = 'user-123';
      const mockReview = {
        _id: reviewId,
        helpfulBy: [],
        helpfulCount: 0,
      };

      mockReviewModel.findById.mockResolvedValueOnce(mockReview);
      mockReviewModel.findByIdAndUpdate.mockResolvedValueOnce({});

      const result = await service.toggleHelpful(reviewId, userId);

      expect(mockReviewModel.findByIdAndUpdate).toHaveBeenCalledWith(reviewId, {
        $addToSet: { helpfulBy: userId },
        $inc: { helpfulCount: 1 },
      });
      expect(result).toEqual({ helpful: true, count: 1 });
    });

    it('should unmark review as helpful', async () => {
      const reviewId = new Types.ObjectId().toString();
      const userId = 'user-123';
      const mockReview = {
        _id: reviewId,
        helpfulBy: [userId],
        helpfulCount: 1,
      };

      mockReviewModel.findById.mockResolvedValueOnce(mockReview);
      mockReviewModel.findByIdAndUpdate.mockResolvedValueOnce({});

      const result = await service.toggleHelpful(reviewId, userId);

      expect(mockReviewModel.findByIdAndUpdate).toHaveBeenCalledWith(reviewId, {
        $pull: { helpfulBy: userId },
        $inc: { helpfulCount: -1 },
      });
      expect(result).toEqual({ helpful: false, count: 0 });
    });
  });

  describe('getPointStatistics', () => {
    it('should calculate point statistics', async () => {
      const pointId = new Types.ObjectId().toString();
      const mockReviews = [
        { rating: 5 }, { rating: 5 }, { rating: 5 }, { rating: 5 },
        { rating: 5 }, { rating: 5 }, { rating: 5 }, { rating: 5 },
        { rating: 4 }, { rating: 4 }, { rating: 4 }, { rating: 4 },
        { rating: 4 }, { rating: 4 }, { rating: 3 }, { rating: 3 },
        { rating: 3 }, { rating: 2 }, { rating: 2 }, { rating: 1 },
      ];

      mockReviewModel.find.mockResolvedValueOnce(mockReviews);

      const result = await (service as any).getPointStatistics(pointId);

      expect(result.totalReviews).toBe(20);
      expect(result.averageRating).toBe(3.9);
      expect(result.ratingDistribution).toEqual({
        '1': 1,
        '2': 2,
        '3': 3,
        '4': 6,
        '5': 8,
      });
    });

    it('should return default stats if no reviews', async () => {
      const pointId = new Types.ObjectId().toString();
      
      mockReviewModel.find.mockResolvedValueOnce([]);

      const result = await (service as any).getPointStatistics(pointId);

      expect(result).toEqual({
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {
          '1': 0,
          '2': 0,
          '3': 0,
          '4': 0,
          '5': 0,
        },
      });
    });
  });
});
