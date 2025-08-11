import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { SearchService } from './search.service';
import { User } from '../users/schemas/user.schema';
import { PointOfInterest } from '../points/schemas/point-of-interest.schema';
import { Collection } from '../collections/schemas/collection.schema';
import { Photo } from '../photos/schemas/photo.schema';

describe('SearchService', () => {
  let service: SearchService;

  const mockUserModel = {
    find: jest.fn(),
    aggregate: jest.fn(),
  };

  const mockPointModel = {
    find: jest.fn(),
    aggregate: jest.fn(),
    distinct: jest.fn(),
  };

  const mockCollectionModel = {
    find: jest.fn(),
    aggregate: jest.fn(),
  };

  const mockPhotoModel = {
    find: jest.fn(),
    aggregate: jest.fn(),
  };

  const mockUser = {
    _id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    profilePicture: null,
    level: 5,
    points: 100,
  };

  const mockPoint = {
    _id: 'point-123',
    name: 'Test Point',
    description: 'A beautiful test location',
    category: 'landscape',
    latitude: 48.8566,
    longitude: 2.3522,
  };

  const mockCollection = {
    _id: 'collection-123',
    name: 'Test Collection',
    description: 'My test collection',
    pointsCount: 10,
    isPublic: true,
  };

  const mockPhoto = {
    _id: 'photo-123',
    url: 'https://example.com/photo.jpg',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    caption: 'Test photo',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(PointOfInterest.name),
          useValue: mockPointModel,
        },
        {
          provide: getModelToken(Collection.name),
          useValue: mockCollectionModel,
        },
        {
          provide: getModelToken(Photo.name),
          useValue: mockPhotoModel,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    jest.clearAllMocks();
  });

  describe('globalSearch', () => {
    it('should search all entities', async () => {
      const query = 'test';

      const mockUserQuery = {
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockUser]),
      };

      const mockPointQuery = {
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockPoint]),
      };

      const mockCollectionQuery = {
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockCollection]),
      };

      const mockPhotoQuery = {
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockPhoto]),
      };

      mockUserModel.find.mockReturnValue(mockUserQuery);
      mockPointModel.find.mockReturnValue(mockPointQuery);
      mockCollectionModel.find.mockReturnValue(mockCollectionQuery);
      mockPhotoModel.find.mockReturnValue(mockPhotoQuery);

      const result = await service.globalSearch(query);

      expect(result).toEqual({
        users: [mockUser],
        points: [mockPoint],
        collections: [mockCollection],
        photos: [mockPhoto],
      });

      expect(mockUserModel.find).toHaveBeenCalledWith({
        isActive: true,
        $or: [{ username: expect.any(RegExp) }, { email: expect.any(RegExp) }],
      });

      expect(mockPointModel.find).toHaveBeenCalledWith({
        isActive: true,
        status: 'approved',
        $or: [
          { name: expect.any(RegExp) },
          { description: expect.any(RegExp) },
          { tags: expect.any(RegExp) },
        ],
      });

      expect(mockCollectionModel.find).toHaveBeenCalledWith({
        isActive: true,
        isPublic: true,
        $or: [
          { name: expect.any(RegExp) },
          { description: expect.any(RegExp) },
          { tags: expect.any(RegExp) },
        ],
      });
    });

    it('should filter by types', async () => {
      const query = 'test';
      const filters = { types: ['points'], limit: 10 };

      const mockPointQuery = {
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockPoint]),
      };

      mockPointModel.find.mockReturnValue(mockPointQuery);

      const result = await service.globalSearch(query, filters);

      expect(result).toEqual({
        users: [],
        points: [mockPoint],
        collections: [],
        photos: [],
      });

      expect(mockUserModel.find).not.toHaveBeenCalled();
      expect(mockCollectionModel.find).not.toHaveBeenCalled();
      expect(mockPhotoModel.find).not.toHaveBeenCalled();
    });
  });

  describe('searchPointsInArea', () => {
    it('should search points within bounds', async () => {
      const bounds = {
        north: 48.9,
        south: 48.8,
        east: 2.4,
        west: 2.3,
      };

      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockPoint]),
      };

      mockPointModel.find.mockReturnValue(mockQuery);

      const result = await service.searchPointsInArea(bounds);

      expect(mockPointModel.find).toHaveBeenCalledWith({
        isActive: true,
        status: 'approved',
        latitude: { $gte: bounds.south, $lte: bounds.north },
        longitude: { $gte: bounds.west, $lte: bounds.east },
      });
      expect(result).toEqual([mockPoint]);
    });

    it('should handle longitude wrap-around', async () => {
      const bounds = {
        north: 48.9,
        south: 48.8,
        east: -170,
        west: 170,
      };

      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockPointModel.find.mockReturnValue(mockQuery);

      await service.searchPointsInArea(bounds);

      expect(mockPointModel.find).toHaveBeenCalledWith({
        isActive: true,
        status: 'approved',
        latitude: { $gte: bounds.south, $lte: bounds.north },
        $or: [
          { longitude: { $gte: bounds.west } },
          { longitude: { $lte: bounds.east } },
        ],
      });
    });

    it('should apply category filter', async () => {
      const bounds = {
        north: 48.9,
        south: 48.8,
        east: 2.4,
        west: 2.3,
      };
      const filters = { categories: ['landscape', 'architecture'] };

      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockPointModel.find.mockReturnValue(mockQuery);

      await service.searchPointsInArea(bounds, filters);

      expect(mockPointModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          category: { $in: filters.categories },
        }),
      );
    });
  });

  describe('searchSuggestions', () => {
    it('should return suggestions for valid query', async () => {
      const query = 'par';

      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([{ name: 'Paris' }, { name: 'Park' }]),
      };

      mockPointModel.find.mockReturnValue(mockQuery);
      mockPointModel.distinct.mockImplementation((field) => {
        if (field === 'category') {
          return Promise.resolve(['park', 'parking']);
        }
        if (field === 'tags') {
          return Promise.resolve(['paris', 'parc']);
        }
        return Promise.resolve([]);
      });

      const result = await service.searchSuggestions(query);

      expect(result).toEqual({
        suggestions: ['Paris', 'Park'],
        categories: ['park', 'parking'],
        tags: ['paris', 'parc'],
      });
    });

    it('should return empty suggestions for short query', async () => {
      const query = 'p';

      const result = await service.searchSuggestions(query);

      expect(result).toEqual({
        suggestions: [],
        categories: [],
        tags: [],
      });

      expect(mockPointModel.find).not.toHaveBeenCalled();
      expect(mockPointModel.distinct).not.toHaveBeenCalled();
    });
  });
});
