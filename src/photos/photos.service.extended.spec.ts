import { Test, TestingModule } from '@nestjs/testing';
import { PhotosService } from './photos.service';
import { UploadService } from '../upload/upload.service';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';

describe('PhotosService - Extended Coverage', () => {
  let service: PhotosService;
  let uploadService: UploadService;
  let photoModel: Model<any>;

  const createMockPhotoModel = () => {
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
    return mockModel;
  };

  const mockPhotoModel = createMockPhotoModel();

  const mockUploadService = {
    uploadImage: jest.fn(),
    deleteImage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotosService,
        {
          provide: getModelToken('Photo'),
          useValue: mockPhotoModel,
        },
        {
          provide: UploadService,
          useValue: mockUploadService,
        },
      ],
    }).compile();

    service = module.get<PhotosService>(PhotosService);
    uploadService = module.get<UploadService>(UploadService);
    photoModel = module.get(getModelToken('Photo'));

    jest.clearAllMocks();

    mockPhotoModel.find.mockReturnThis();
    mockPhotoModel.findById.mockReturnThis();
    mockPhotoModel.sort.mockReturnThis();
    mockPhotoModel.skip.mockReturnThis();
    mockPhotoModel.limit.mockReturnThis();
    mockPhotoModel.populate.mockReturnThis();
  });

  describe('create', () => {
    it('should create a photo with session', async () => {
      const createPhotoDto = {
        url: 'https://example.com/photo.jpg',
        pointId: '507f1f77bcf86cd799439011',
        caption: 'Test photo',
      };
      const userId = '507f1f77bcf86cd799439012';
      const mockSession = { session: 'mock-session' };

      const mockSave = jest.fn().mockResolvedValueOnce({
        id: 'photo-123',
        ...createPhotoDto,
        userId: new Types.ObjectId(userId),
      });

      const mockConstructor = jest.fn(() => ({
        save: mockSave,
      }));

      (photoModel as any).mockImplementation(mockConstructor);

      const result = await service.create(createPhotoDto, userId, mockSession);

      expect(mockSave).toHaveBeenCalledWith({ session: mockSession });
      expect(result).toHaveProperty('id', 'photo-123');
    });
  });

  describe('findAll', () => {
    it('should handle filters with userId', async () => {
      const filters = {
        userId: '507f1f77bcf86cd799439011',
        page: 2,
        limit: 30,
      };

      const mockPhotos = [
        { id: 'photo-1', userId: filters.userId },
        { id: 'photo-2', userId: filters.userId },
      ];

      mockPhotoModel.exec.mockResolvedValueOnce(mockPhotos);
      mockPhotoModel.countDocuments.mockResolvedValueOnce(50);

      const result = await service.findAll(filters);

      expect(result.data).toEqual(mockPhotos);
      expect(result.total).toBe(50);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(30);
      expect(mockPhotoModel.find).toHaveBeenCalledWith({
        isActive: true,
        status: 'approved',
        userId: new Types.ObjectId(filters.userId),
      });
    });

    it('should handle filters with pointId', async () => {
      const filters = {
        pointId: '507f1f77bcf86cd799439011',
      };

      const mockPhotos = [{ id: 'photo-1', pointId: filters.pointId }];

      mockPhotoModel.exec.mockResolvedValueOnce(mockPhotos);
      mockPhotoModel.countDocuments.mockResolvedValueOnce(1);

      const result = await service.findAll(filters);

      expect(mockPhotoModel.find).toHaveBeenCalledWith({
        isActive: true,
        status: 'approved',
        pointId: new Types.ObjectId(filters.pointId),
      });
    });
  });

  describe('findOne', () => {
    it('should throw BadRequestException for invalid photo ID', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        'Invalid photo ID',
      );
    });

    it('should throw NotFoundException when photo not found', async () => {
      mockPhotoModel.exec.mockResolvedValueOnce(null);

      await expect(
        service.findOne('507f1f77bcf86cd799439011'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findOne('507f1f77bcf86cd799439011'),
      ).rejects.toThrow('Photo not found');
    });
  });

  describe('update', () => {
    it('should throw BadRequestException for invalid photo ID', async () => {
      await expect(
        service.update('invalid-id', { caption: 'New caption' }, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when photo not found', async () => {
      mockPhotoModel.findById.mockResolvedValueOnce(null as any);

      await expect(
        service.update(
          '507f1f77bcf86cd799439011',
          { caption: 'New caption' },
          'user-123',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user tries to update another user photo', async () => {
      const mockPhoto = {
        id: '507f1f77bcf86cd799439011',
        userId: new Types.ObjectId('507f1f77bcf86cd799439012'),
      };

      // Important : valeur persistante pour chaque appel éventuel
      mockPhotoModel.findById.mockResolvedValue(mockPhoto as any);

      await expect(
        service.update(
          '507f1f77bcf86cd799439011',
          { caption: 'New caption' },
          '507f1f77bcf86cd799439013', // Different user
        ),
      ).rejects.toThrow('You can only update your own photos');
    });

    it('should handle case when findByIdAndUpdate returns null', async () => {
      const userId = '507f1f77bcf86cd799439012';
      const mockPhoto = {
        id: '507f1f77bcf86cd799439011',
        userId: new Types.ObjectId(userId),
      };

      mockPhotoModel.findById.mockResolvedValueOnce(mockPhoto as any);
      mockPhotoModel.findByIdAndUpdate.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(null),
      } as any);

      await expect(
        service.update(
          '507f1f77bcf86cd799439011',
          { caption: 'New caption' },
          userId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should throw BadRequestException for invalid photo ID', async () => {
      await expect(service.remove('invalid-id', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when photo not found', async () => {
      mockPhotoModel.findById.mockResolvedValueOnce(null as any);

      await expect(
        service.remove('507f1f77bcf86cd799439011', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user tries to delete another user photo', async () => {
      const mockPhoto = {
        id: '507f1f77bcf86cd799439011',
        userId: new Types.ObjectId('507f1f77bcf86cd799439012'),
      };

      // Important : valeur persistante pour chaque appel éventuel
      mockPhotoModel.findById.mockResolvedValue(mockPhoto as any);

      await expect(
        service.remove(
          '507f1f77bcf86cd799439011',
          '507f1f77bcf86cd799439013', // Different user
        ),
      ).rejects.toThrow('You can only delete your own photos');
    });
  });

  describe('toggleLike', () => {
    it('should throw BadRequestException for invalid photo ID', async () => {
      await expect(
        service.toggleLike('invalid-id', 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when photo not found', async () => {
      mockPhotoModel.findById.mockResolvedValueOnce(null as any);

      await expect(
        service.toggleLike('507f1f77bcf86cd799439011', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should unlike when photo is already liked', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const photoId = '507f191e810c19729de860ea';

      const mockPhoto: any = {
        id: photoId,
        likedBy: [new Types.ObjectId(userId)],
        likesCount: 5,
      };

      mockPhoto.likedBy.some = jest.fn().mockReturnValue(true);

      mockPhotoModel.findById = jest.fn().mockResolvedValueOnce(mockPhoto);
      mockPhotoModel.findByIdAndUpdate.mockResolvedValueOnce({});

      const result = await service.toggleLike(photoId, userId);

      expect(result).toEqual({ liked: false, count: 4 });
      expect(mockPhotoModel.findByIdAndUpdate).toHaveBeenCalledWith(photoId, {
        $pull: { likedBy: expect.any(Types.ObjectId) },
        $inc: { likesCount: -1 },
      });
    });
  });

  describe('getTopPhotos', () => {
    it('should return top photos with custom limit', async () => {
      const mockTopPhotos = [
        { id: 'photo-1', likesCount: 100, viewCount: 1000 },
        { id: 'photo-2', likesCount: 90, viewCount: 900 },
        { id: 'photo-3', likesCount: 80, viewCount: 800 },
      ];

      mockPhotoModel.exec.mockResolvedValueOnce(mockTopPhotos);

      const result = await service.getTopPhotos(3);

      expect(result).toEqual(mockTopPhotos);
      expect(mockPhotoModel.limit).toHaveBeenCalledWith(3);
      expect(mockPhotoModel.sort).toHaveBeenCalledWith({
        likesCount: -1,
        viewCount: -1,
      });
    });
  });

  describe('getRecentPhotos', () => {
    it('should return recent photos with custom limit', async () => {
      const mockRecentPhotos = [
        { id: 'photo-1', createdAt: new Date('2024-01-03') },
        { id: 'photo-2', createdAt: new Date('2024-01-02') },
        { id: 'photo-3', createdAt: new Date('2024-01-01') },
      ];

      mockPhotoModel.exec.mockResolvedValueOnce(mockRecentPhotos);

      const result = await service.getRecentPhotos(3);

      expect(result).toEqual(mockRecentPhotos);
      expect(mockPhotoModel.limit).toHaveBeenCalledWith(3);
      expect(mockPhotoModel.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });

  describe('uploadPhoto', () => {
    it('should handle upload failure and cleanup', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('test'),
        size: 1024,
      } as Express.Multer.File;

      const uploadDto = {
        pointId: '507f1f77bcf86cd799439011',
        caption: 'Test photo',
        tags: ['test', 'photo'],
        isPublic: false,
      };

      const mockUploadedFile = {
        originalUrl: 'https://storage.example.com/photo.jpg',
        thumbnailUrl: 'https://storage.example.com/thumb.jpg',
        mediumUrl: 'https://storage.example.com/medium.jpg',
        largeUrl: 'https://storage.example.com/large.jpg',
        filename: 'photo-123.jpg',
        originalName: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        width: 1920,
        height: 1080,
      };

      mockUploadService.uploadImage.mockResolvedValueOnce(mockUploadedFile);

      const saveError = new Error('Database error');
      const mockSave = jest.fn().mockRejectedValueOnce(saveError);
      const mockConstructor = jest.fn(() => ({
        save: mockSave,
      }));

      (photoModel as any).mockImplementation(mockConstructor);

      await expect(
        service.uploadPhoto(mockFile, uploadDto, '507f1f77bcf86cd799439011'),
      ).rejects.toThrow(saveError);

      expect(mockUploadService.deleteImage).toHaveBeenCalledWith(
        mockUploadedFile.filename,
      );
    });

    it('should handle upload with undefined pointId', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('test'),
        size: 1024,
      } as Express.Multer.File;

      // On force `any` pour ignorer le `pointId` requis par le DTO.
      const uploadDto: any = {
        caption: 'Test photo without point',
        tags: [],
      };

      const mockUploadedFile = {
        originalUrl: 'https://storage.example.com/photo.jpg',
        thumbnailUrl: 'https://storage.example.com/thumb.jpg',
        mediumUrl: 'https://storage.example.com/medium.jpg',
        largeUrl: 'https://storage.example.com/large.jpg',
        filename: 'photo-123.jpg',
        originalName: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        width: 1920,
        height: 1080,
      };

      const mockSavedPhoto = {
        id: 'photo-123',
        ...mockUploadedFile,
        pointId: undefined,
        userId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      };

      mockUploadService.uploadImage.mockResolvedValueOnce(mockUploadedFile);

      const mockSave = jest.fn().mockResolvedValueOnce(mockSavedPhoto);
      const mockConstructor = jest.fn(() => ({
        save: mockSave,
      }));

      (photoModel as any).mockImplementation(mockConstructor);

      const result = await service.uploadPhoto(
        mockFile,
        uploadDto,
        '507f1f77bcf86cd799439011',
      );

      expect(result).toEqual(mockSavedPhoto);
      expect(mockConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          pointId: undefined,
        }),
      );
    });
  });

  describe('findByPoint', () => {
    it('should throw BadRequestException for invalid point ID', async () => {
      await expect(service.findByPoint('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findByPoint('invalid-id')).rejects.toThrow(
        'Invalid point ID',
      );
    });

    it('should return photos for valid point with filtering', async () => {
      const pointId = '507f1f77bcf86cd799439011';
      const mockPhotos = [
        { id: 'photo-1', pointId, status: 'approved', isActive: true },
        { id: 'photo-2', pointId, status: 'approved', isActive: true },
      ];

      mockPhotoModel.exec.mockResolvedValueOnce(mockPhotos);

      const result = await service.findByPoint(pointId);

      expect(result).toEqual(mockPhotos);
      expect(mockPhotoModel.find).toHaveBeenCalledWith({
        pointId: new Types.ObjectId(pointId),
        isActive: true,
        status: 'approved',
      });
      expect(mockPhotoModel.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });
});
