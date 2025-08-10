import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CollectionsService } from './collections.service';
import { Collection, CollectionDocument } from './schemas/collection.schema';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CollectionsService', () => {
  let service: CollectionsService;
  let model: Model<CollectionDocument>;

  const mockCollection = {
    _id: 'collection-123',
    userId: 'user-123',
    name: 'My Collection',
    description: 'Test collection',
    points: [],
    pointsCount: 0,
    isPublic: true,
    isActive: true,
    followers: [],
    followersCount: 0,
    save: jest.fn(),
  };

  const mockCollectionModel = jest.fn().mockImplementation((dto) => ({
    ...dto,
    save: jest.fn().mockResolvedValue({ ...mockCollection, ...dto }),
  })) as any;

  mockCollectionModel.create = jest.fn();
  mockCollectionModel.find = jest.fn();
  mockCollectionModel.findOne = jest.fn();
  mockCollectionModel.findById = jest.fn();
  mockCollectionModel.findByIdAndUpdate = jest.fn();
  mockCollectionModel.findByIdAndDelete = jest.fn();
  mockCollectionModel.countDocuments = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsService,
        {
          provide: getModelToken(Collection.name),
          useValue: mockCollectionModel,
        },
      ],
    }).compile();

    service = module.get<CollectionsService>(CollectionsService);
    model = module.get<Model<CollectionDocument>>(getModelToken(Collection.name));
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new collection', async () => {
      const createDto = {
        name: 'New Collection',
        description: 'Test',
        isPublic: true,
      };
      const userId = 'user-123';

      const result = await service.create(createDto, userId);

      expect(mockCollectionModel).toHaveBeenCalledWith({
        ...createDto,
        userId,
      });
      expect(result).toHaveProperty('name', createDto.name);
    });

    it('should add to default collection when only pointId is provided', async () => {
      const createDto = { pointId: '507f1f77bcf86cd799439011' };
      const userId = 'user-123';

      mockCollectionModel.findOne.mockResolvedValue(null);

      const result = await service.create(createDto, userId);

      expect(mockCollectionModel.findOne).toHaveBeenCalledWith({
        userId,
        name: 'Mes favoris',
        isDefault: true,
      });
      expect(mockCollectionModel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Mes favoris',
          isDefault: true,
          points: [expect.any(Types.ObjectId)],
        })
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated collections', async () => {
      const collections = [mockCollection];
      const filters = { page: 1, limit: 20 };

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(collections),
      };

      mockCollectionModel.find.mockReturnValue(mockQuery);
      mockCollectionModel.countDocuments.mockResolvedValue(1);

      const result = await service.findAll(filters);

      expect(mockCollectionModel.find).toHaveBeenCalledWith({ isActive: true });
      expect(result).toEqual({
        data: collections,
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('should filter by userId', async () => {
      const userId = 'user-123';
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockCollectionModel.find.mockReturnValue(mockQuery);
      mockCollectionModel.countDocuments.mockResolvedValue(0);

      await service.findAll({ userId });

      expect(mockCollectionModel.find).toHaveBeenCalledWith({
        isActive: true,
        userId,
      });
    });
  });

  describe('findOne', () => {
    it('should return a collection by id', async () => {
      const collectionId = new Types.ObjectId().toString();
      
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockCollection),
      };

      mockCollectionModel.findById.mockReturnValue(mockQuery);

      const result = await service.findOne(collectionId);

      expect(mockCollectionModel.findById).toHaveBeenCalledWith(collectionId);
      expect(result).toEqual(mockCollection);
    });

    it('should throw BadRequestException for invalid id', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw NotFoundException if collection not found', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockCollectionModel.findById.mockReturnValue(mockQuery);

      await expect(
        service.findOne(new Types.ObjectId().toString())
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addPoint', () => {
    it('should add a point to collection', async () => {
      const collectionId = 'collection-123';
      const pointId = new Types.ObjectId().toString();
      const userId = 'user-123';
      
      const collection = {
        ...mockCollection,
        points: [],
        save: jest.fn().mockResolvedValue(mockCollection),
      };

      mockCollectionModel.findById.mockResolvedValue(collection);

      const result = await service.addPoint(collectionId, pointId, userId);

      expect(collection.save).toHaveBeenCalled();
      expect(collection.points).toHaveLength(1);
    });

    it('should not duplicate points', async () => {
      const collectionId = 'collection-123';
      const existingPointId = new Types.ObjectId();
      const userId = 'user-123';
      
      const collection = {
        ...mockCollection,
        points: [existingPointId],
        save: jest.fn(),
      };

      mockCollectionModel.findById.mockResolvedValue(collection);

      await service.addPoint(collectionId, existingPointId.toString(), userId);

      expect(collection.save).not.toHaveBeenCalled();
    });

    it('should throw error if user is not owner', async () => {
      const collection = { ...mockCollection, userId: 'other-user' };
      mockCollectionModel.findById.mockResolvedValue(collection);

      await expect(
        service.addPoint('collection-123', 'point-123', 'user-123')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removePoint', () => {
    it('should remove a point from collection', async () => {
      const collectionId = 'collection-123';
      const pointId = new Types.ObjectId();
      const userId = 'user-123';
      
      const collection = {
        ...mockCollection,
        points: [pointId],
        save: jest.fn().mockResolvedValue(mockCollection),
      };

      mockCollectionModel.findById.mockResolvedValue(collection);

      const result = await service.removePoint(
        collectionId,
        pointId.toString(),
        userId
      );

      expect(collection.save).toHaveBeenCalled();
      expect(collection.points).toHaveLength(0);
    });
  });

  describe('isPointInUserCollections', () => {
    it('should return true if point is in user collections', async () => {
      const pointId = new Types.ObjectId().toString();
      const userId = 'user-123';

      mockCollectionModel.findOne.mockResolvedValue(mockCollection);

      const result = await service.isPointInUserCollections(pointId, userId);

      expect(result).toBe(true);
      expect(mockCollectionModel.findOne).toHaveBeenCalledWith({
        userId,
        points: expect.any(Types.ObjectId),
        isActive: true,
      });
    });

    it('should return false if point is not in user collections', async () => {
      mockCollectionModel.findOne.mockResolvedValue(null);

      const result = await service.isPointInUserCollections(
        new Types.ObjectId().toString(),
        'user-123'
      );

      expect(result).toBe(false);
    });
  });

  describe('toggleFollow', () => {
    it('should follow a collection', async () => {
      const collectionId = 'collection-123';
      const userId = 'user-456';
      const collection = { ...mockCollection, followers: [], followersCount: 0 };

      mockCollectionModel.findById.mockResolvedValue(collection);
      mockCollectionModel.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.toggleFollow(collectionId, userId);

      expect(result).toEqual({ following: true, count: 1 });
      expect(mockCollectionModel.findByIdAndUpdate).toHaveBeenCalledWith(
        collectionId,
        {
          $addToSet: { followers: userId },
          $inc: { followersCount: 1 },
        }
      );
    });

    it('should unfollow a collection', async () => {
      const collectionId = 'collection-123';
      const userId = 'user-456';
      const collection = {
        ...mockCollection,
        followers: [userId],
        followersCount: 1,
      };

      mockCollectionModel.findById.mockResolvedValue(collection);
      mockCollectionModel.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.toggleFollow(collectionId, userId);

      expect(result).toEqual({ following: false, count: 0 });
      expect(mockCollectionModel.findByIdAndUpdate).toHaveBeenCalledWith(
        collectionId,
        {
          $pull: { followers: userId },
          $inc: { followersCount: -1 },
        }
      );
    });
  });

  describe('addToDefaultCollection', () => {
    it('should create default collection if not exists', async () => {
      const pointId = new Types.ObjectId().toString();
      const userId = 'user-123';

      mockCollectionModel.findOne.mockResolvedValue(null);

      const result = await service.addToDefaultCollection(pointId, userId);

      expect(mockCollectionModel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Mes favoris',
          isDefault: true,
          userId,
          points: [expect.any(Types.ObjectId)],
        })
      );
    });

    it('should add to existing default collection', async () => {
      const pointId = new Types.ObjectId().toString();
      const userId = 'user-123';
      const existingCollection = {
        ...mockCollection,
        name: 'Mes favoris',
        isDefault: true,
        points: [],
        save: jest.fn().mockResolvedValue(mockCollection),
      };

      mockCollectionModel.findOne.mockResolvedValue(existingCollection);

      await service.addToDefaultCollection(pointId, userId);

      expect(existingCollection.points).toHaveLength(1);
      expect(existingCollection.save).toHaveBeenCalled();
    });
  });

  describe('removeFromDefaultCollection', () => {
    it('should remove point from default collection', async () => {
      const pointId = new Types.ObjectId();
      const userId = 'user-123';
      const defaultCollection = {
        ...mockCollection,
        name: 'Mes favoris',
        isDefault: true,
        points: [pointId],
        save: jest.fn(),
      };

      mockCollectionModel.findOne.mockResolvedValue(defaultCollection);

      await service.removeFromDefaultCollection(pointId.toString(), userId);

      expect(defaultCollection.points).toHaveLength(0);
      expect(defaultCollection.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if default collection not found', async () => {
      mockCollectionModel.findOne.mockResolvedValue(null);

      await expect(
        service.removeFromDefaultCollection(
          new Types.ObjectId().toString(),
          'user-123'
        )
      ).rejects.toThrow(NotFoundException);
    });
  });
});
