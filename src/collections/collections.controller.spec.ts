import { Test, TestingModule } from '@nestjs/testing';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { Types } from 'mongoose';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

describe('CollectionsController', () => {
  let controller: CollectionsController;
  let service: CollectionsService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockCollection = {
    _id: new Types.ObjectId().toString(),
    userId: mockUser.id,
    name: 'My Collection',
    description: 'Test collection',
    points: [],
    pointsCount: 0,
    isPublic: true,
  };

  const mockCollectionsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    addPoint: jest.fn(),
    removePoint: jest.fn(),
    isPointInUserCollections: jest.fn(),
    removeFromDefaultCollection: jest.fn(),
    toggleFollow: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [
        {
          provide: CollectionsService,
          useValue: mockCollectionsService,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<CollectionsController>(CollectionsController);
    service = module.get<CollectionsService>(CollectionsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new collection', async () => {
      const createDto = {
        name: 'New Collection',
        description: 'Test',
        isPublic: true,
      };

      mockCollectionsService.create.mockResolvedValue(mockCollection);

      const result = await controller.create(createDto, { user: mockUser });

      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.id);
      expect(result).toEqual(mockCollection);
    });

    it('should add to default collection with only pointId', async () => {
      const createDto = { pointId: 'point-123' };

      mockCollectionsService.create.mockResolvedValue({
        ...mockCollection,
        name: 'Mes favoris',
        isDefault: true,
      });

      const result = await controller.create(createDto, { user: mockUser });

      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.id);
    });
  });

  describe('findAll', () => {
    it('should return all collections', async () => {
      const mockResult = {
        data: [mockCollection],
        total: 1,
        page: 1,
        limit: 20,
      };

      mockCollectionsService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith({});
      expect(result).toEqual(mockResult);
    });

    it('should apply filters', async () => {
      const filters = {
        userId: 'user-123',
        isPublic: true,
        page: 2,
        limit: 10,
      };

      mockCollectionsService.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 10,
      });

      await controller.findAll(filters.userId, filters.isPublic, filters.page, filters.limit);

      expect(service.findAll).toHaveBeenCalledWith(filters);
    });
  });

  describe('findOne', () => {
    it('should return a collection by id', async () => {
      const collectionId = mockCollection._id;

      mockCollectionsService.findOne.mockResolvedValue(mockCollection);

      const result = await controller.findOne(collectionId);

      expect(service.findOne).toHaveBeenCalledWith(collectionId);
      expect(result).toEqual(mockCollection);
    });
  });

  describe('addPoint', () => {
    it('should add a point to collection', async () => {
      const collectionId = mockCollection._id;
      const pointId = 'point-123';

      mockCollectionsService.addPoint.mockResolvedValue({
        ...mockCollection,
        points: [pointId],
        pointsCount: 1,
      });

      const result = await controller.addPoint(
        collectionId,
        pointId,
        { user: mockUser }
      );

      expect(service.addPoint).toHaveBeenCalledWith(
        collectionId,
        pointId,
        mockUser.id
      );
      expect(result.points).toContain(pointId);
    });
  });

  describe('removePoint', () => {
    it('should remove a point from collection', async () => {
      const collectionId = mockCollection._id;
      const pointId = 'point-123';

      mockCollectionsService.removePoint.mockResolvedValue(mockCollection);

      const result = await controller.removePoint(
        collectionId,
        pointId,
        { user: mockUser }
      );

      expect(service.removePoint).toHaveBeenCalledWith(
        collectionId,
        pointId,
        mockUser.id
      );
      expect(result).toEqual(mockCollection);
    });
  });

  describe('isPointInCollection', () => {
    it('should check if point is in user collections', async () => {
      const pointId = 'point-123';

      mockCollectionsService.isPointInUserCollections.mockResolvedValue(true);

      const result = await controller.isPointInCollection(
        pointId,
        { user: mockUser }
      );

      expect(service.isPointInUserCollections).toHaveBeenCalledWith(
        pointId,
        mockUser.id
      );
      expect(result).toBe(true);
    });
  });

  describe('removeFromCollection', () => {
    it('should remove point from default collection', async () => {
      const pointId = 'point-123';

      mockCollectionsService.removeFromDefaultCollection.mockResolvedValue(undefined);

      await controller.removeFromCollection(pointId, { user: mockUser });

      expect(service.removeFromDefaultCollection).toHaveBeenCalledWith(
        pointId,
        mockUser.id
      );
    });
  });

  describe('toggleFollow', () => {
    it('should toggle follow on collection', async () => {
      const collectionId = mockCollection._id;
      const followResult = { following: true, count: 5 };

      mockCollectionsService.toggleFollow.mockResolvedValue(followResult);

      const result = await controller.toggleFollow(
        collectionId,
        { user: mockUser }
      );

      expect(service.toggleFollow).toHaveBeenCalledWith(
        collectionId,
        mockUser.id
      );
      expect(result).toEqual(followResult);
    });
  });
});
