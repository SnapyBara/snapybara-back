import { Test, TestingModule } from '@nestjs/testing';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

describe('PhotosController', () => {
  let controller: PhotosController;
  let service: PhotosService;

  const mockPhotosService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    uploadPhoto: jest.fn(),
    toggleLike: jest.fn(),
    getTopPhotos: jest.fn(),
    getRecentPhotos: jest.fn(),
    findBySupabaseUserId: jest.fn(),
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
      controllers: [PhotosController],
      providers: [
        {
          provide: PhotosService,
          useValue: mockPhotosService,
        },
        {
          provide: SupabaseAuthGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<PhotosController>(PhotosController);
    service = module.get<PhotosService>(PhotosService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a photo', async () => {
      const createPhotoDto = {
        pointId: '123',
        url: 'https://example.com/photo.jpg',
        caption: 'Test photo',
      };
      const expectedResult = { _id: '1', ...createPhotoDto };

      mockPhotosService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createPhotoDto, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockPhotosService.create).toHaveBeenCalledWith(
        createPhotoDto,
        mockUser.id,
      );
    });
  });

  describe('uploadPhoto', () => {
    it('should upload a photo', async () => {
      const file = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
      } as Express.Multer.File;
      const uploadDto = {
        pointId: '123',
        caption: 'Test upload',
      };
      const expectedResult = {
        _id: 'photo-1',
        url: 'https://storage.example.com/photo.jpg',
      };

      mockPhotosService.uploadPhoto.mockResolvedValue(expectedResult);

      const result = await controller.uploadPhoto(file, uploadDto, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockPhotosService.uploadPhoto).toHaveBeenCalledWith(
        file,
        uploadDto,
        mockUser.id,
      );
    });
  });

  describe('findAll', () => {
    it('should return all photos with filters', async () => {
      const expectedResult = {
        data: [
          { _id: '1', url: 'https://example.com/photo1.jpg' },
          { _id: '2', url: 'https://example.com/photo2.jpg' },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };

      mockPhotosService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(
        '507f1f77bcf86cd799439011',
        undefined,
        1,
        10,
      );

      expect(result).toEqual(expectedResult);
      expect(mockPhotosService.findAll).toHaveBeenCalledWith({
        pointId: '507f1f77bcf86cd799439011',
        userId: undefined,
        page: 1,
        limit: 10,
      });
    });

    it('should use findBySupabaseUserId for non-ObjectId userId', async () => {
      const expectedResult = {
        data: [
          { _id: '1', url: 'https://example.com/photo1.jpg' },
          { _id: '2', url: 'https://example.com/photo2.jpg' },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };

      mockPhotosService.findBySupabaseUserId.mockResolvedValue(expectedResult);

      const result = await controller.findAll(undefined, 'user-456', 1, 10);

      expect(result).toEqual(expectedResult);
      expect(mockPhotosService.findBySupabaseUserId).toHaveBeenCalledWith(
        'user-456',
        1,
        10,
      );
    });

    it('should return all photos without filters', async () => {
      const expectedResult = {
        data: [],
        total: 0,
      };

      mockPhotosService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();

      expect(result).toEqual(expectedResult);
      expect(mockPhotosService.findAll).toHaveBeenCalledWith({
        pointId: undefined,
        userId: undefined,
        page: undefined,
        limit: undefined,
      });
    });
  });

  describe('getTopPhotos', () => {
    it('should return top photos', async () => {
      const expectedResult = [
        { _id: '1', url: 'https://example.com/top1.jpg', likes: 100 },
        { _id: '2', url: 'https://example.com/top2.jpg', likes: 90 },
      ];

      mockPhotosService.getTopPhotos.mockResolvedValue(expectedResult);

      const result = await controller.getTopPhotos(10);

      expect(result).toEqual(expectedResult);
      expect(mockPhotosService.getTopPhotos).toHaveBeenCalledWith(10);
    });

    it('should return top photos with default limit', async () => {
      const expectedResult = [];

      mockPhotosService.getTopPhotos.mockResolvedValue(expectedResult);

      const result = await controller.getTopPhotos();

      expect(result).toEqual(expectedResult);
      expect(mockPhotosService.getTopPhotos).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getRecentPhotos', () => {
    it('should return recent photos', async () => {
      const expectedResult = [
        {
          _id: '1',
          url: 'https://example.com/recent1.jpg',
          createdAt: new Date(),
        },
        {
          _id: '2',
          url: 'https://example.com/recent2.jpg',
          createdAt: new Date(),
        },
      ];

      mockPhotosService.getRecentPhotos.mockResolvedValue(expectedResult);

      const result = await controller.getRecentPhotos(5);

      expect(result).toEqual(expectedResult);
      expect(mockPhotosService.getRecentPhotos).toHaveBeenCalledWith(5);
    });
  });

  describe('findOne', () => {
    it('should return a single photo', async () => {
      const photoId = '1';
      const expectedResult = {
        _id: photoId,
        url: 'https://example.com/photo.jpg',
      };

      mockPhotosService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(photoId);

      expect(result).toEqual(expectedResult);
      expect(mockPhotosService.findOne).toHaveBeenCalledWith(photoId);
    });
  });

  describe('update', () => {
    it('should update a photo', async () => {
      const photoId = '1';
      const updateDto = { caption: 'Updated caption' };
      const expectedResult = {
        _id: photoId,
        caption: 'Updated caption',
      };

      mockPhotosService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(photoId, updateDto, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockPhotosService.update).toHaveBeenCalledWith(
        photoId,
        updateDto,
        mockUser.id,
      );
    });
  });

  describe('remove', () => {
    it('should remove a photo', async () => {
      const photoId = '1';

      await controller.remove(photoId, mockRequest);

      expect(mockPhotosService.remove).toHaveBeenCalledWith(
        photoId,
        mockUser.id,
      );
    });
  });

  describe('toggleLike', () => {
    it('should toggle like on a photo', async () => {
      const photoId = '1';
      const expectedResult = { liked: true, totalLikes: 10 };

      mockPhotosService.toggleLike.mockResolvedValue(expectedResult);

      const result = await controller.toggleLike(photoId, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockPhotosService.toggleLike).toHaveBeenCalledWith(
        photoId,
        mockUser.id,
      );
    });
  });
});
