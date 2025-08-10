import { Test, TestingModule } from '@nestjs/testing';
import { PointsService } from './points.service';
import { getModelToken } from '@nestjs/mongoose';
import { PhotosService } from '../photos/photos.service';
import { GooglePlacesService } from '../google-places/google-places.service';
import { UploadService } from '../upload/upload.service';
import { OverpassService } from '../overpass/overpass.service';
import { PhotoEnrichmentService } from '../overpass/photo-enrichment.service';
import { UsersService } from '../users/users.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('PointsService', () => {
  let service: PointsService;
  let photosService: PhotosService;

  global.fetch = jest.fn(() =>
    Promise.resolve({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: { get: () => 'image/jpeg' },
    } as unknown as Response),
  );

  const createMockPointModel = () => {
    const mockModel: any = jest.fn();
    mockModel.find = jest.fn().mockReturnThis();
    mockModel.findById = jest.fn().mockReturnThis();
    mockModel.findByIdAndUpdate = jest.fn().mockReturnThis();
    mockModel.countDocuments = jest.fn();
    mockModel.sort = jest.fn().mockReturnThis();
    mockModel.skip = jest.fn().mockReturnThis();
    mockModel.limit = jest.fn().mockReturnThis();
    mockModel.populate = jest.fn().mockReturnThis();
    mockModel.exec = jest.fn();
    mockModel.aggregate = jest.fn();
    mockModel.updateOne = jest.fn();
    mockModel.db = {
      startSession: jest.fn().mockReturnValue({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      }),
    };
    return mockModel;
  };

  const mockPointModel = createMockPointModel();

  const mockPhotosService = {
    uploadPhoto: jest.fn(),
    findByPoint: jest.fn(),
    create: jest.fn(),
  };

  const mockGooglePlacesService = {
    convertToPointOfInterest: jest.fn(),
    nearbySearch: jest.fn(),
    textSearch: jest.fn(),
    getPlaceDetails: jest.fn(),
  };

  const mockUploadService = { uploadImage: jest.fn() };
  const mockOverpassService = { searchPOIs: jest.fn() };
  const mockPhotoEnrichmentService = { enrichPOIsWithPhotos: jest.fn() };
  const mockUsersService = { findBySupabaseId: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        { provide: getModelToken('PointOfInterest'), useValue: mockPointModel },
        { provide: PhotosService, useValue: mockPhotosService },
        { provide: GooglePlacesService, useValue: mockGooglePlacesService },
        { provide: UploadService, useValue: mockUploadService },
        { provide: OverpassService, useValue: mockOverpassService },
        { provide: PhotoEnrichmentService, useValue: mockPhotoEnrichmentService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<PointsService>(PointsService);
    photosService = module.get<PhotosService>(PhotosService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a point', async () => {
      const createPointDto = {
        name: 'Test Point',
        description: 'Test Description',
        latitude: 48.8566,
        longitude: 2.3522,
        category: 'restaurant',
      };

      const mockUser = { _id: new Types.ObjectId(), username: 'testuser' };
      mockUsersService.findBySupabaseId.mockResolvedValueOnce(mockUser);

      const mockCreatedPoint = {
        ...createPointDto,
        _id: new Types.ObjectId(),
        userId: mockUser._id,
        save: jest.fn().mockResolvedValue(this),
      };

      mockPointModel.mockImplementationOnce(() => mockCreatedPoint);

      const result = await service.create(createPointDto, 'supabase-user-123');
      expect(mockUsersService.findBySupabaseId).toHaveBeenCalledWith('supabase-user-123');
      expect(mockPointModel).toHaveBeenCalled();
      expect(mockCreatedPoint.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUsersService.findBySupabaseId.mockResolvedValueOnce(null);
      await expect(
        service.create({ name: 'Test', latitude: 0, longitude: 0, category: 'test' }, 'invalid-user')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a point', async () => {
      const mockPoint = { _id: '507f1f77bcf86cd799439011', name: 'Test Point', viewCount: 10 };
      mockPointModel.exec.mockResolvedValueOnce(mockPoint);

      const result = await service.findOne('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockPoint);
      expect(mockPointModel.findByIdAndUpdate).toHaveBeenCalledWith('507f1f77bcf86cd799439011', { $inc: { viewCount: 1 } });
    });

    it('should throw NotFoundException for non-existent point', async () => {
      mockPointModel.exec.mockResolvedValueOnce(null);
      await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findNearby', () => {
    it('should find nearby points', async () => {
      const mockPoints = [{ name: 'Point 1', distance: 100 }];
      mockPointModel.exec.mockResolvedValueOnce(mockPoints);

      const result = await service.findNearby(48.8566, 2.3522, 1);
      expect(result).toEqual(mockPoints);
      expect(mockPointModel.find).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a point', async () => {
      const updateDto = { name: 'Updated Name', description: 'Updated Description' };
      const mockUser = { _id: new Types.ObjectId(), username: 'testuser' };
      const mockPoint = { _id: '507f1f77bcf86cd799439011', userId: mockUser._id };
      const mockUpdatedPoint = { ...mockPoint, ...updateDto };

      mockUsersService.findBySupabaseId.mockResolvedValueOnce(mockUser);
      mockPointModel.findById.mockResolvedValueOnce(mockPoint);
      mockPointModel.findByIdAndUpdate.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockUpdatedPoint),
      });

      const result = await service.update('507f1f77bcf86cd799439011', updateDto, 'user-123');
      expect(result).toEqual(mockUpdatedPoint);
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUsersService.findBySupabaseId.mockResolvedValueOnce(null);
      await expect(service.update('507f1f77bcf86cd799439011', { name: 'New Name' }, 'user-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if point not found', async () => {
      const mockUser = { _id: new Types.ObjectId() };
      mockUsersService.findBySupabaseId.mockResolvedValueOnce(mockUser);
      mockPointModel.findById.mockResolvedValueOnce(null);
      await expect(service.update('507f1f77bcf86cd799439011', { name: 'New Name' }, 'user-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchHybrid', () => {
    it('should return search results with correct structure', async () => {
      const searchDto = {
        query: 'restaurant',
        latitude: 48.8566,
        longitude: 2.3522,
        radius: 1000,
        categories: [],
        tags: [],
      };

      const mockMongoResults = [
        { 
          name: 'Mongo Restaurant', 
          source: 'mongodb',
          latitude: 48.8566,
          longitude: 2.3522,
          metadata: {}
        },
      ];

      mockPointModel.aggregate
        .mockResolvedValueOnce(mockMongoResults)
        .mockResolvedValueOnce([{ total: 1 }]);

      mockOverpassService.searchPOIs.mockResolvedValueOnce({ data: [] });

      const result = await service.searchHybrid(searchDto);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('sources');
      expect(result.sources).toHaveProperty('mongodb');
      expect(result.sources).toHaveProperty('openstreetmap');
      expect(result.sources.mongodb).toBe(1);
      expect(result.sources.openstreetmap).toBe(0);
    });
  });

  describe('createWithPhotos', () => {
    it('should create point with photos DTO', async () => {
      const createDto = {
        name: 'Test Point',
        latitude: 48.8566,
        longitude: 2.3522,
        category: 'restaurant' as any,
        photos: [{ imageData: 'https://example.com/photo1.jpg', caption: 'Test photo' }],
      };
      const supabaseUserId = 'user-123';
      const mockUser = { _id: new Types.ObjectId() };
      const mockPoint = {
        _id: new Types.ObjectId(),
        ...createDto,
        save: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      };

      mockPointModel.db.startSession.mockReturnValueOnce({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      });
      mockUsersService.findBySupabaseId.mockResolvedValueOnce(mockUser);
      mockPointModel.mockImplementationOnce(() => mockPoint);
      mockPointModel.updateOne.mockResolvedValueOnce({});
      mockPointModel.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockPoint),
      });
      mockUploadService.uploadImage.mockResolvedValueOnce({
        url: 'https://storage.example.com/photo.jpg',
        thumbnailUrl: '',
        mediumUrl: '',
        metadata: {},
      });
      mockPhotosService.create.mockResolvedValueOnce({ _id: 'photo-123', url: 'https://storage.example.com/photo.jpg' });

      const result = await service.createWithPhotos(createDto, supabaseUserId);
      expect(result).toHaveProperty('point');
      expect(result).toHaveProperty('photos');
    });
  });

  describe('uploadPhotoForPoint', () => {
    it('should upload photo for a point', async () => {
      const pointId = '507f1f77bcf86cd799439011';
      const supabaseUserId = 'user-123';
      const mockFile = { buffer: Buffer.from('test'), originalname: 'test.jpg', mimetype: 'image/jpeg' } as Express.Multer.File;
      const metadata = { caption: 'Test photo' };
      const mockPoint = { _id: pointId, name: 'Test Point' };
      const mockUser = { _id: 'mongo-user-123' };
      const mockUploadedPhoto = {
        _id: 'photo-123',
        url: 'https://storage.example.com/test.jpg',
        pointId,
        userId: 'mongo-user-123',
        caption: 'Test photo',
      };

      mockPointModel.exec.mockResolvedValueOnce(mockPoint);
      mockUsersService.findBySupabaseId.mockResolvedValueOnce(mockUser);
      mockPhotosService.uploadPhoto.mockResolvedValueOnce(mockUploadedPhoto);
      mockPointModel.findByIdAndUpdate.mockResolvedValueOnce({});

      const result = await service.uploadPhotoForPoint(pointId, mockFile, metadata, supabaseUserId);
      expect(mockPhotosService.uploadPhoto).toHaveBeenCalledWith(
        mockFile,
        { pointId, caption: metadata.caption, tags: [], isPublic: true },
        mockUser._id,
      );
      expect(result).toEqual(mockUploadedPhoto);
    });
  });

  describe('getPointPhotos', () => {
    it('should get photos for a point', async () => {
      const pointId = '507f1f77bcf86cd799439011';
      const mockPhotos = [
        { id: 'photo-1', url: 'https://example.com/photo1.jpg' },
        { id: 'photo-2', url: 'https://example.com/photo2.jpg' },
      ];

      mockPhotosService.findByPoint.mockResolvedValueOnce(mockPhotos);
      const result = await service.getPointPhotos(pointId);
      expect(result).toEqual(mockPhotos);
      expect(mockPhotosService.findByPoint).toHaveBeenCalledWith(pointId);
    });
  });
});
