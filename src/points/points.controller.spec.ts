import { Test, TestingModule } from '@nestjs/testing';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { PhotosService } from '../photos/photos.service';
import { ReviewsService } from '../reviews/reviews.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { CreatePointDto } from './dto/create-point.dto';
import { UpdatePointOfInterestDto } from './dto/update-point.dto';

describe('PointsController', () => {
  let controller: PointsController;
  let service: PointsService;

  const mockPointsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findNearby: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    searchHybrid: jest.fn(),
  };

  const mockPhotosService = {
    findByPoint: jest.fn(),
    uploadPhoto: jest.fn(),
  };

  const mockReviewsService = {
    findAll: jest.fn(),
    create: jest.fn(),
  };

  const mockAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { id: 'test-user-id', email: 'test@example.com' };
      return true;
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PointsController],
      providers: [
        {
          provide: PointsService,
          useValue: mockPointsService,
        },
        {
          provide: PhotosService,
          useValue: mockPhotosService,
        },
        {
          provide: ReviewsService,
          useValue: mockReviewsService,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<PointsController>(PointsController);
    service = module.get<PointsService>(PointsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new point', async () => {
      const createPointDto: CreatePointDto = {
        name: 'Test Point',
        description: 'A test point of interest',
        category: 'restaurant',
        latitude: 48.8566,
        longitude: 2.3522,
        tags: ['test', 'restaurant'],
      };

      const mockCreatedPoint = {
        id: '123',
        ...createPointDto,
        createdBy: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending',
      };

      mockPointsService.create.mockResolvedValueOnce(mockCreatedPoint);

      const result = await controller.create(createPointDto, {
        user: { id: 'test-user-id' },
      });

      expect(result).toEqual(mockCreatedPoint);
      expect(mockPointsService.create).toHaveBeenCalledWith(
        createPointDto,
        'test-user-id',
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated points', async () => {
      const mockPoints = [
        {
          id: '1',
          name: 'Point 1',
          category: 'restaurant',
          location: { type: 'Point', coordinates: [2.3522, 48.8566] },
        },
        {
          id: '2',
          name: 'Point 2',
          category: 'park',
          location: { type: 'Point', coordinates: [2.3532, 48.8576] },
        },
      ];

      const mockResponse = {
        data: mockPoints,
        total: 2,
        page: 1,
        limit: 10,
      };

      mockPointsService.findAll.mockResolvedValueOnce(mockResponse);

      const result = await controller.findAll({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockResponse);
      expect(mockPointsService.findAll).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update an existing point', async () => {
      const pointId = '123';
      const updatePointDto: UpdatePointOfInterestDto = {
        name: 'Updated Point Name',
        description: 'Updated description',
      };

      const mockUpdatedPoint = {
        id: pointId,
        name: 'Updated Point Name',
        description: 'Updated description',
        category: 'restaurant',
        updatedAt: new Date(),
      };

      mockPointsService.update.mockResolvedValueOnce(mockUpdatedPoint);

      const result = await controller.update(
        pointId,
        updatePointDto,
        { user: { id: 'test-user-id' } },
      );

      expect(result).toEqual(mockUpdatedPoint);
      expect(mockPointsService.update).toHaveBeenCalledWith(
        pointId,
        updatePointDto,
        'test-user-id',
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a point', async () => {
      const pointId = '123';

      mockPointsService.remove.mockResolvedValueOnce({ success: true });

      const result = await controller.remove(pointId, {
        user: { id: 'test-user-id' },
      });

      expect(result).toEqual({ success: true });
      expect(mockPointsService.remove).toHaveBeenCalledWith(
        pointId,
        'test-user-id',
      );
    });
  });
});
