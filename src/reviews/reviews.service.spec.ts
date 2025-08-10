import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PointsService } from '../points/points.service';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let pointsService: PointsService;

  const createMockReviewModel = () => {
    const mockModel: any = jest.fn();
    mockModel.find = jest.fn().mockReturnThis();
    mockModel.findOne = jest.fn();
    mockModel.findById = jest.fn().mockReturnThis();
    mockModel.countDocuments = jest.fn();
    mockModel.sort = jest.fn().mockReturnThis();
    mockModel.skip = jest.fn().mockReturnThis();
    mockModel.limit = jest.fn().mockReturnThis();
    mockModel.populate = jest.fn().mockReturnThis();
    mockModel.exec = jest.fn();
    mockModel.aggregate = jest.fn();
    return mockModel;
  };

  const mockReviewModel = createMockReviewModel();

  const mockPointsService = {
    updatePointStatistics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getModelToken('Review'),
          useValue: mockReviewModel,
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

      const mockSavedReview = {
        ...createReviewDto,
        userId: 'user-123',
        _id: new Types.ObjectId(),
      };

      const mockInstance = {
        save: jest.fn().mockResolvedValue(mockSavedReview),
      };

      mockReviewModel.mockImplementationOnce(() => mockInstance);

      jest.spyOn(service as any, 'getPointStatistics').mockResolvedValueOnce({
        averageRating: 4.5,
        totalReviews: 10,
        ratingDistribution: {},
      });

      const result = await service.create(createReviewDto, 'user-123');

      expect(result).toEqual(mockSavedReview);
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
  });
});
