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

describe('PointsService Extended Tests', () => {
  let service: PointsService;

  const createMockPointModel = () => {
    const mockModel: any = jest.fn();
    mockModel.find = jest.fn().mockReturnThis();
    mockModel.findById = jest.fn().mockReturnThis();
    mockModel.findByIdAndUpdate = jest.fn().mockReturnThis();
    mockModel.findByIdAndDelete = jest.fn().mockReturnThis();
    mockModel.updateOne = jest.fn();
    mockModel.countDocuments = jest.fn();
    mockModel.distinct = jest.fn();
    mockModel.sort = jest.fn().mockReturnThis();
    mockModel.skip = jest.fn().mockReturnThis();
    mockModel.limit = jest.fn().mockReturnThis();
    mockModel.populate = jest.fn().mockReturnThis();
    mockModel.select = jest.fn().mockReturnThis();
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
    jest.clearAllMocks();
  });

  describe('findByUser', () => {
    it('should return points for a user', async () => {
      const mockUser = { _id: new Types.ObjectId() };
      const mockPoints = [
        { _id: '1', name: 'Point 1', userId: mockUser._id },
        { _id: '2', name: 'Point 2', userId: mockUser._id },
      ];

      mockUsersService.findBySupabaseId.mockResolvedValueOnce(mockUser);
      mockPointModel.exec.mockResolvedValueOnce(mockPoints);

      const result = await service.findByUser('supabase-123');
      expect(result).toEqual(mockPoints);
      expect(mockUsersService.findBySupabaseId).toHaveBeenCalledWith('supabase-123');
    });

    it('should return empty array if user not found', async () => {
      mockUsersService.findBySupabaseId.mockResolvedValueOnce(null);
      const result = await service.findByUser('invalid-user');
      expect(result).toEqual([]);
    });
  });

  describe('remove', () => {
    it('should soft delete a point', async () => {
      const pointId = new Types.ObjectId().toString();
      const mockUser = { _id: new Types.ObjectId() };
      const mockPoint = { _id: pointId, userId: mockUser._id };

      mockUsersService.findBySupabaseId.mockResolvedValueOnce(mockUser);
      mockPointModel.findById.mockResolvedValueOnce(mockPoint);
      mockPointModel.findByIdAndUpdate.mockResolvedValueOnce({});

      await service.remove(pointId, 'user-123');

      expect(mockPointModel.findByIdAndUpdate).toHaveBeenCalledWith(pointId, {
        isActive: false,
        updatedAt: expect.any(Date),
      });
    });

    it('should throw error if user is not the owner', async () => {
      const pointId = new Types.ObjectId().toString();
      const mockUser = { _id: new Types.ObjectId() };
      const otherUserId = new Types.ObjectId();
      const mockPoint = { _id: pointId, userId: otherUserId };

      mockUsersService.findBySupabaseId.mockResolvedValueOnce(mockUser);
      mockPointModel.findById.mockResolvedValueOnce(mockPoint);

      await expect(service.remove(pointId, 'user-123')).rejects.toThrow(
        'You can only delete your own points',
      );
    });
  });

  describe('updatePointStatistics', () => {
    it('should update point statistics', async () => {
      const pointId = new Types.ObjectId().toString();
      const stats = { averageRating: 4.5, totalReviews: 10 };

      mockPointModel.findByIdAndUpdate.mockResolvedValueOnce({});

      await service.updatePointStatistics(pointId, stats);

      expect(mockPointModel.findByIdAndUpdate).toHaveBeenCalledWith(
        pointId,
        {
          $set: {
            'statistics.averageRating': stats.averageRating,
            'statistics.totalReviews': stats.totalReviews,
          },
        },
        { new: true },
      );
    });

    it('should throw error for invalid point ID', async () => {
      await expect(
        service.updatePointStatistics('invalid-id', { averageRating: 4, totalReviews: 1 }),
      ).rejects.toThrow('Invalid point ID');
    });
  });

  describe('getPendingPoints', () => {
    it('should return pending points with pagination', async () => {
      const mockPendingPoints = [
        { _id: '1', name: 'Pending 1', status: 'pending' },
        { _id: '2', name: 'Pending 2', status: 'pending' },
      ];

      mockPointModel.exec.mockResolvedValueOnce(mockPendingPoints);
      mockPointModel.countDocuments.mockResolvedValueOnce(10);

      const result = await service.getPendingPoints(1, 2);

      expect(result).toEqual({
        data: mockPendingPoints,
        total: 10,
        page: 1,
        limit: 2,
      });
      expect(mockPointModel.find).toHaveBeenCalledWith({ status: 'pending' });
      expect(mockPointModel.skip).toHaveBeenCalledWith(0);
      expect(mockPointModel.limit).toHaveBeenCalledWith(2);
    });
  });

  describe('updatePointStatus', () => {
    it('should approve a point', async () => {
      const pointId = new Types.ObjectId().toString();
      const mockPoint = { _id: pointId, status: 'pending' };
      const mockUpdatedPoint = { ...mockPoint, status: 'approved' };

      mockPointModel.findById.mockResolvedValueOnce(mockPoint);
      mockPointModel.exec.mockResolvedValueOnce(mockUpdatedPoint);

      const result = await service.updatePointStatus(pointId, 'approved', 'admin-123');

      expect(result).toEqual(mockUpdatedPoint);
      expect(mockPointModel.findByIdAndUpdate).toHaveBeenCalledWith(
        pointId,
        expect.objectContaining({
          status: 'approved',
          'metadata.approvedBy': 'admin-123',
          'metadata.approvedAt': expect.any(Date),
        }),
        { new: true },
      );
    });

    it('should reject a point with reason', async () => {
      const pointId = new Types.ObjectId().toString();
      const mockPoint = { _id: pointId, status: 'pending' };
      const mockUpdatedPoint = { ...mockPoint, status: 'rejected' };

      mockPointModel.findById.mockResolvedValueOnce(mockPoint);
      mockPointModel.exec.mockResolvedValueOnce(mockUpdatedPoint);

      const result = await service.updatePointStatus(
        pointId,
        'rejected',
        'admin-123',
        'Inappropriate content',
      );

      expect(result).toEqual(mockUpdatedPoint);
      expect(mockPointModel.findByIdAndUpdate).toHaveBeenCalledWith(
        pointId,
        expect.objectContaining({
          status: 'rejected',
          'metadata.rejectionReason': 'Inappropriate content',
          'metadata.rejectedBy': 'admin-123',
          'metadata.rejectedAt': expect.any(Date),
        }),
        { new: true },
      );
    });
  });

  describe('adminDeletePoint', () => {
    it('should permanently delete a point', async () => {
      const pointId = new Types.ObjectId().toString();
      const mockPoint = { _id: pointId, name: 'Test Point' };

      mockPointModel.findById.mockResolvedValueOnce(mockPoint);
      mockPointModel.findByIdAndDelete.mockResolvedValueOnce({});

      await service.adminDeletePoint(pointId, 'admin-123');

      expect(mockPointModel.findByIdAndDelete).toHaveBeenCalledWith(pointId);
    });

    it('should throw error if point not found', async () => {
      const pointId = new Types.ObjectId().toString();
      mockPointModel.findById.mockResolvedValueOnce(null);

      await expect(service.adminDeletePoint(pointId, 'admin-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getModerationStats', () => {
    it('should return moderation statistics', async () => {
      const mockRecentSubmissions = [
        {
          _id: '1',
          name: 'Recent 1',
          createdAt: new Date(),
          userId: { username: 'user1', email: 'user1@example.com' },
        },
      ];

      mockPointModel.countDocuments
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(3) // approved today
        .mockResolvedValueOnce(1) // rejected today
        .mockResolvedValueOnce(100); // total POIs

      mockPointModel.exec.mockResolvedValueOnce(mockRecentSubmissions);
      mockPointModel.distinct.mockResolvedValueOnce(['user1', 'user2']);

      const result = await service.getModerationStats();

      expect(result).toEqual({
        pendingCount: 5,
        approvedToday: 3,
        rejectedToday: 1,
        totalPOIs: 100,
        activeUsers: 2,
        recentSubmissions: [
          {
            id: '1',
            name: 'Recent 1',
            submittedBy: {
              username: 'user1',
              email: 'user1@example.com',
            },
            createdAt: expect.any(Date),
          },
        ],
      });
    });
  });

  describe('getPlaceFromGooglePlaces', () => {
    it('should get place from Google Places without saving', async () => {
      const placeId = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
      const mockGooglePlace = {
        place_id: placeId,
        name: 'Sydney Opera House',
        geometry: { location: { lat: -33.8568, lng: 151.2153 } },
      };
      const mockConverted = {
        name: 'Sydney Opera House',
        latitude: -33.8568,
        longitude: 151.2153,
        category: 'architecture',
      };

      mockGooglePlacesService.getPlaceDetails.mockResolvedValueOnce(mockGooglePlace);
      mockGooglePlacesService.convertToPointOfInterest.mockReturnValueOnce(mockConverted);

      const result = await service.getPlaceFromGooglePlaces(placeId, false);

      expect(result).toMatchObject({
        ...mockConverted,
        isPublic: true,
        isActive: true,
        status: 'approved',
      });
    });

    it('should save place to MongoDB when requested', async () => {
      const placeId = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
      const mockGooglePlace = {
        place_id: placeId,
        name: 'Sydney Opera House',
      };
      const mockConverted = {
        name: 'Sydney Opera House',
        latitude: -33.8568,
        longitude: 151.2153,
        category: 'architecture',
      };
      const mockSaved = {
        ...mockConverted,
        _id: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue({ ...mockConverted, _id: new Types.ObjectId() }),
      };

      mockGooglePlacesService.getPlaceDetails.mockResolvedValueOnce(mockGooglePlace);
      mockGooglePlacesService.convertToPointOfInterest.mockReturnValueOnce(mockConverted);
      mockPointModel.mockImplementationOnce(() => mockSaved);

      const result = await service.getPlaceFromGooglePlaces(placeId, true);

      expect(mockSaved.save).toHaveBeenCalled();
    });
  });

  describe('importFromGooglePlaces', () => {
    it('should import places from Google Places', async () => {
      const mockGooglePlaces = [
        { place_id: '1', name: 'Place 1' },
        { place_id: '2', name: 'Place 2' },
      ];
      const mockConverted = {
        name: 'Place 1',
        latitude: 48.8566,
        longitude: 2.3522,
        category: 'architecture',
      };

      mockGooglePlacesService.nearbySearch.mockResolvedValueOnce(mockGooglePlaces);
      mockGooglePlacesService.convertToPointOfInterest.mockReturnValue(mockConverted);
      
      // Mock filterExistingPlaces to return all places as new
      jest.spyOn(service as any, 'filterExistingPlaces').mockResolvedValueOnce(mockGooglePlaces);
      
      const mockSaved = {
        ...mockConverted,
        save: jest.fn().mockResolvedValue({}),
      };
      mockPointModel.mockImplementation(() => mockSaved);

      const result = await service.importFromGooglePlaces(48.8566, 2.3522, 5, 2);

      expect(result).toEqual({
        imported: 2,
        skipped: 0,
        errors: 0,
      });
    });
  });

  describe('enrichPOIsWithPhotos', () => {
    it('should enrich POIs with photos', async () => {
      const mockPOIs = [
        { id: '1', name: 'POI 1' },
        { id: '2', name: 'POI 2' },
      ];
      const mockEnriched = [
        {
          id: '1',
          name: 'POI 1',
          photos: [{ url: 'http://photo1.jpg', width: 800, height: 600 }],
        },
        {
          id: '2',
          name: 'POI 2',
          photos: [{ url: 'http://photo2.jpg', width: 800, height: 600 }],
        },
      ];

      mockPhotoEnrichmentService.enrichPOIsWithPhotos.mockResolvedValueOnce(mockEnriched);

      const result = await service.enrichPOIsWithPhotos(mockPOIs);

      expect(result).toEqual({
        '1': [
          {
            reference: 'http://photo1.jpg',
            url: 'http://photo1.jpg',
            width: 800,
            height: 600,
            attribution: undefined,
          },
        ],
        '2': [
          {
            reference: 'http://photo2.jpg',
            url: 'http://photo2.jpg',
            width: 800,
            height: 600,
            attribution: undefined,
          },
        ],
      });
    });
  });

  describe('categoriesToStrings', () => {
    it('should convert enum categories to lowercase strings', () => {
      const categories = ['RESTAURANT', 'CAFE', 'Bar'] as any[];
      const result = (service as any).categoriesToStrings(categories);
      expect(result).toEqual(['restaurant', 'cafe', 'bar']);
    });

    it('should return undefined for undefined input', () => {
      const result = (service as any).categoriesToStrings(undefined);
      expect(result).toBeUndefined();
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      // Distance between Paris and London (approx 344km)
      const distance = (service as any).calculateDistance(48.8566, 2.3522, 51.5074, -0.1278);
      expect(distance).toBeGreaterThan(340000); // > 340km
      expect(distance).toBeLessThan(350000); // < 350km
    });
  });

  describe('mapOSMTypeToCategory', () => {
    it('should map OSM types to categories correctly', () => {
      expect((service as any).mapOSMTypeToCategory('viewpoint')).toBe('landscape');
      expect((service as any).mapOSMTypeToCategory('museum')).toBe('historical');
      expect((service as any).mapOSMTypeToCategory('church')).toBe('architecture');
      expect((service as any).mapOSMTypeToCategory('waterfall')).toBe('landscape');
      expect((service as any).mapOSMTypeToCategory('unknown-type')).toBe('other');
    });
  });

  describe('generateDescription', () => {
    it('should generate description from OSM tags', () => {
      const osmPOI = {
        name: 'Test POI',
        type: 'viewpoint',
        tags: {
          description: 'Beautiful viewpoint',
          tourism: 'viewpoint',
          historic: 'monument',
          heritage: 'yes',
        },
      };

      const description = (service as any).generateDescription(osmPOI);
      expect(description).toContain('Beautiful viewpoint');
      expect(description).toContain('Type: viewpoint');
      expect(description).toContain('Historic: monument');
      expect(description).toContain('Site classé au patrimoine');
    });
  });

  describe('extractTags', () => {
    it('should extract unique tags from OSM POI', () => {
      const osmPOI = {
        type: 'museum',
        tags: {
          tourism: 'museum',
          historic: 'castle',
          amenity: 'parking',
          heritage: 'yes',
          wikipedia: 'en:Example',
        },
      };

      const tags = (service as any).extractTags(osmPOI);
      expect(tags).toContain('museum');
      expect(tags).toContain('castle');
      expect(tags).toContain('parking');
      expect(tags).toContain('patrimoine');
      expect(tags).toContain('wikipedia');
      expect(tags.length).toBe(new Set(tags).size); // Check uniqueness
    });
  });
});
