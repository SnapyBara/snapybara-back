import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let service: ReviewsService;

  const mockReviewsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getPointStatistics: jest.fn(),
    toggleHelpful: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockRequest = {
    user: mockUser,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: mockReviewsService,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ReviewsController>(ReviewsController);
    service = module.get<ReviewsService>(ReviewsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a review', async () => {
      const createReviewDto: CreateReviewDto = {
        pointId: 'point-123',
        rating: 5,
        comment: 'Excellent!',
      };
      const expectedResult = {
        _id: 'review-1',
        userId: mockUser.id,
        ...createReviewDto,
        createdAt: new Date(),
      };

      mockReviewsService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createReviewDto, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockReviewsService.create).toHaveBeenCalledWith(createReviewDto, mockUser.id);
    });
  });

  describe('findAll', () => {
    it('should return all reviews with filters', async () => {
      const expectedResult = {
        data: [
          {
            _id: 'review-1',
            pointId: 'point-123',
            userId: 'user-1',
            rating: 5,
            comment: 'Great!',
          },
          {
            _id: 'review-2',
            pointId: 'point-124',
            userId: 'user-2',
            rating: 4,
            comment: 'Good',
          },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };

      mockReviewsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll('point-123', 'user-456', 1, 10);

      expect(result).toEqual(expectedResult);
      expect(mockReviewsService.findAll).toHaveBeenCalledWith({
        pointId: 'point-123',
        userId: 'user-456',
        page: 1,
        limit: 10,
      });
    });

    it('should return all reviews without filters', async () => {
      const expectedResult = {
        data: [],
        total: 0,
      };

      mockReviewsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();

      expect(result).toEqual(expectedResult);
      expect(mockReviewsService.findAll).toHaveBeenCalledWith({
        pointId: undefined,
        userId: undefined,
        page: undefined,
        limit: undefined,
      });
    });
  });

  describe('getPointStatistics', () => {
    it('should return statistics for a point', async () => {
      const pointId = 'point-123';
      const expectedResult = {
        averageRating: 4.5,
        totalReviews: 10,
        ratingDistribution: {
          1: 0,
          2: 1,
          3: 1,
          4: 3,
          5: 5,
        },
      };

      mockReviewsService.getPointStatistics.mockResolvedValue(expectedResult);

      const result = await controller.getPointStatistics(pointId);

      expect(result).toEqual(expectedResult);
      expect(mockReviewsService.getPointStatistics).toHaveBeenCalledWith(pointId);
    });
  });

  describe('findOne', () => {
    it('should return a single review', async () => {
      const reviewId = 'review-1';
      const expectedResult = {
        _id: reviewId,
        pointId: 'point-123',
        userId: 'user-1',
        rating: 5,
        comment: 'Excellent!',
      };

      mockReviewsService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(reviewId);

      expect(result).toEqual(expectedResult);
      expect(mockReviewsService.findOne).toHaveBeenCalledWith(reviewId);
    });
  });

  describe('update', () => {
    it('should update a review', async () => {
      const reviewId = 'review-1';
      const updateReviewDto: UpdateReviewDto = {
        rating: 4,
        comment: 'Updated comment',
      };
      const expectedResult = {
        _id: reviewId,
        pointId: 'point-123',
        userId: mockUser.id,
        ...updateReviewDto,
        updatedAt: new Date(),
      };

      mockReviewsService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(reviewId, updateReviewDto, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockReviewsService.update).toHaveBeenCalledWith(
        reviewId,
        updateReviewDto,
        mockUser.id,
      );
    });
  });

  describe('remove', () => {
    it('should remove a review', async () => {
      const reviewId = 'review-1';
      mockReviewsService.remove.mockResolvedValue(undefined);

      await controller.remove(reviewId, mockRequest);

      expect(mockReviewsService.remove).toHaveBeenCalledWith(reviewId, mockUser.id);
    });
  });

  describe('toggleHelpful', () => {
    it('should toggle helpful on a review', async () => {
      const reviewId = 'review-1';
      const expectedResult = { helpful: true, totalHelpful: 5 };

      mockReviewsService.toggleHelpful.mockResolvedValue(expectedResult);

      const result = await controller.toggleHelpful(reviewId, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockReviewsService.toggleHelpful).toHaveBeenCalledWith(reviewId, mockUser.id);
    });
  });
});
