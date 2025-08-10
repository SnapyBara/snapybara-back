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

  const createMockPointModel = () => {
    const mockModel: any = jest.fn();
    mockModel.find = jest.fn().mockReturnThis();
    mockModel.findById = jest.fn().mockReturnThis();
    mockModel.findByIdAndUpdate = jest.fn();
    mockModel.countDocuments = jest.fn();
    mockModel.sort = jest.fn().mockReturnThis();
    mockModel.skip = jest.fn().mockReturnThis();
    mockModel.limit = jest.fn().mockReturnThis();
    mockModel.populate = jest.fn().mockReturnThis();
    mockModel.exec = jest.fn();
    mockModel.aggregate = jest.fn();
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

  const mockUploadService = {
    uploadImage: jest.fn(),
  };

  const mockOverpassService = {
    searchPOIs: jest.fn(),
  };

  const mockPhotoEnrichmentService = {
    enrichPOIsWithPhotos: jest.fn(),
  };

  const mockUsersService = {
    findBySupabaseId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        {
          provide: getModelToken('PointOfInterest'),
          useValue: mockPointModel,
        },
        {
          provide: PhotosService,
          useValue: mockPhotosService,
        },
        {
          provide: GooglePlacesService,
          useValue: mockGooglePlacesService,
        },
        {
          provide: UploadService,
          useValue: mockUploadService,
        },
        {
          provide: OverpassService,
          useValue: mockOverpassService,
        },
        {
          provide: PhotoEnrichmentService,
          useValue: mockPhotoEnrichmentService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<PointsService>(PointsService);
    photosService = module.get<PhotosService>(PhotosService);

    jest.clearAllMocks();
    
    mockPointModel.find.mockReturnThis();
    mockPointModel.findById.mockReturnThis();
    mockPointModel.sort.mockReturnThis();
    mockPointModel.skip.mockReturnThis();
    mockPointModel.limit.mockReturnThis();
    mockPointModel.populate.mockReturnThis();
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

      const mockUser = {
        _id: new Types.ObjectId(),
        username: 'testuser',
      };

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
        service.create({
          name: 'Test',
          latitude: 0,
          longitude: 0,
          category: 'test',
        }, 'invalid-user')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a point', async () => {
      const mockPoint = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test Point',
        viewCount: 10,
      };

      mockPointModel.exec.mockResolvedValueOnce(mockPoint);

      const result = await service.findOne('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockPoint);
      expect(mockPointModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { $inc: { viewCount: 1 } }
      );
    });

    it('should throw NotFoundException for non-existent point', async () => {
      mockPointModel.exec.mockResolvedValueOnce(null);

      await expect(
        service.findOne('507f1f77bcf86cd799439011')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findNearby', () => {
    it('should find nearby points', async () => {
      const mockPoints = [
        { name: 'Point 1', distance: 100 },
        { name: 'Point 2', distance: 200 },
      ];

      mockPointModel.exec.mockResolvedValueOnce(mockPoints);

      const result = await service.findNearby(48.8566, 2.3522, 1);

      expect(result).toEqual(mockPoints);
      expect(mockPointModel.find).toHaveBeenCalled();
    });
  });
});
