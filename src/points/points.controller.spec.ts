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
    uploadPhotoForPoint: jest.fn(),
    createWithPhotos: jest.fn(),
    importFromGooglePlaces: jest.fn(),
    findByUser: jest.fn(),
    getPointPhotos: jest.fn(),
    getPendingPoints: jest.fn(),
    updatePointStatus: jest.fn(),
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

      const result = await controller.update(pointId, updatePointDto, {
        user: { id: 'test-user-id' },
      });

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

  describe('findOne', () => {
    it('should return a single point', async () => {
      const pointId = '123';
      const mockPoint = {
        id: pointId,
        name: 'Test Point',
        category: 'restaurant',
        viewCount: 10,
      };

      mockPointsService.findOne.mockResolvedValueOnce(mockPoint);

      const result = await controller.findOne(pointId);

      expect(result).toEqual(mockPoint);
      expect(mockPointsService.findOne).toHaveBeenCalledWith(pointId);
    });
  });

  describe('getNearby', () => {
    it('should find nearby points', async () => {
      const mockNearbyPoints = [
        { id: '1', name: 'Nearby 1', distance: 100 },
        { id: '2', name: 'Nearby 2', distance: 200 },
      ];

      mockPointsService.findNearby.mockResolvedValueOnce(mockNearbyPoints);

      const result = await controller.getNearby(48.8566, 2.3522, 1);

      expect(result).toEqual(mockNearbyPoints);
      expect(mockPointsService.findNearby).toHaveBeenCalledWith(
        48.8566,
        2.3522,
        1,
      );
    });
  });

  describe('searchHybrid', () => {
    it('should perform hybrid search', async () => {
      const searchDto = {
        query: 'restaurant',
        latitude: 48.8566,
        longitude: 2.3522,
        radius: 1000,
      };

      const mockSearchResults = {
        data: [{ name: 'Combined Results' }],
        total: 1,
        page: 1,
        limit: 10,
        sources: {
          mongodb: 1,
          openstreetmap: 0,
        },
      };

      mockPointsService.searchHybrid.mockResolvedValueOnce(mockSearchResults);

      const result = await controller.searchHybrid(searchDto);

      expect(result).toEqual(mockSearchResults);
      expect(mockPointsService.searchHybrid).toHaveBeenCalledWith(
        expect.objectContaining({
          ...searchDto,
          includeGooglePlaces: false,
          includeOpenStreetMap: true,
        }),
      );
    });
  });

  describe('uploadPointPhoto', () => {
    it('should upload photo to point', async () => {
      const pointId = '123';
      const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const mockUpdatedPoint = {
        id: pointId,
        photos: ['photo-123'],
      };

      mockPointsService.uploadPhotoForPoint = jest
        .fn()
        .mockResolvedValueOnce(mockUpdatedPoint);

      const result = await controller.uploadPointPhoto(
        pointId,
        mockFile,
        { caption: 'Test photo' },
        { user: { id: 'test-user-id' } },
      );

      expect(result).toEqual(mockUpdatedPoint);
      expect(mockPointsService.uploadPhotoForPoint).toHaveBeenCalledWith(
        pointId,
        mockFile,
        { caption: 'Test photo' },
        'test-user-id',
      );
    });
  });

  describe('createWithPhotos', () => {
    it('should create point with photos', async () => {
      const createDto = {
        name: 'Test Point',
        latitude: 48.8566,
        longitude: 2.3522,
        category: 'restaurant' as any,
        photos: [],
      };

      const mockCreatedPoint = {
        id: '123',
        ...createDto,
      };

      mockPointsService.createWithPhotos = jest
        .fn()
        .mockResolvedValueOnce(mockCreatedPoint);

      const result = await controller.createWithPhotos(createDto, {
        user: { id: 'test-user-id' },
      });

      expect(result).toEqual(mockCreatedPoint);
      expect(mockPointsService.createWithPhotos).toHaveBeenCalledWith(
        createDto,
        'test-user-id',
      );
    });
  });

  describe('importFromGooglePlaces', () => {
    it('should import places from Google Places', async () => {
      const importDto = {
        latitude: 48.8566,
        longitude: 2.3522,
        radiusKm: 1,
        maxPlaces: 20,
      };
      const mockResult = {
        imported: 15,
        skipped: 3,
        errors: 2,
      };

      mockPointsService.importFromGooglePlaces = jest
        .fn()
        .mockResolvedValueOnce(mockResult);

      const result = await controller.importFromGooglePlaces(importDto);

      expect(result).toEqual(mockResult);
      expect(mockPointsService.importFromGooglePlaces).toHaveBeenCalledWith(
        48.8566,
        2.3522,
        1,
        20,
      );
    });
  });

  describe('getByUser', () => {
    it('should return user points', async () => {
      const userId = 'user-123';
      const mockPoints = [
        { id: '1', name: 'User Point 1' },
        { id: '2', name: 'User Point 2' },
      ];

      mockPointsService.findByUser = jest
        .fn()
        .mockResolvedValueOnce(mockPoints);

      const result = await controller.getByUser(userId);

      expect(result).toEqual(mockPoints);
      expect(mockPointsService.findByUser).toHaveBeenCalledWith(userId);
    });
  });

  describe('getPointPhotos', () => {
    it('should return photos for a point', async () => {
      const pointId = '123';
      const mockPhotos = [
        { id: 'photo-1', url: 'https://example.com/photo1.jpg' },
        { id: 'photo-2', url: 'https://example.com/photo2.jpg' },
      ];

      mockPointsService.getPointPhotos = jest
        .fn()
        .mockResolvedValueOnce(mockPhotos);

      const result = await controller.getPointPhotos(pointId);

      expect(result).toEqual(mockPhotos);
      expect(mockPointsService.getPointPhotos).toHaveBeenCalledWith(pointId);
    });
  });

  describe('getPointReviews', () => {
    it('should return reviews for a point', async () => {
      const pointId = '123';
      const mockReviews = {
        data: [
          { id: 'review-1', rating: 5, comment: 'Great!' },
          { id: 'review-2', rating: 4, comment: 'Good' },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };

      mockReviewsService.findAll.mockResolvedValueOnce(mockReviews);

      const result = await controller.getPointReviews(pointId);

      expect(result).toEqual(mockReviews);
      expect(mockReviewsService.findAll).toHaveBeenCalledWith({ pointId });
    });
  });

  describe('admin endpoints', () => {
    it('should get pending points', async () => {
      const mockPendingPoints = [
        { id: '1', name: 'Pending 1', status: 'pending' },
      ];

      mockPointsService.getPendingPoints = jest
        .fn()
        .mockResolvedValueOnce(mockPendingPoints);

      const result = await controller.getPendingPoints(1, 20);

      expect(result).toEqual(mockPendingPoints);
      expect(mockPointsService.getPendingPoints).toHaveBeenCalledWith(1, 20);
    });

    it('should approve a point', async () => {
      const pointId = '123';
      const mockApprovedPoint = {
        id: pointId,
        status: 'approved',
      };

      mockPointsService.updatePointStatus = jest
        .fn()
        .mockResolvedValueOnce(mockApprovedPoint);

      const result = await controller.approvePoint(pointId, {
        user: { id: 'admin-id' },
      });

      expect(result).toEqual(mockApprovedPoint);
      expect(mockPointsService.updatePointStatus).toHaveBeenCalledWith(
        pointId,
        'approved',
        'admin-id',
      );
    });
  });
});
