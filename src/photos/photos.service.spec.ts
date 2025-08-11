import { Test, TestingModule } from '@nestjs/testing';
import { PhotosService } from './photos.service';
import { UploadService } from '../upload/upload.service';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';

describe('PhotosService', () => {
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByPoint', () => {
    it('should return photos for a valid point', async () => {
      const mockPhotos = [
        { id: 'photo-1', pointId: 'point-123', caption: 'Photo 1' },
        { id: 'photo-2', pointId: 'point-123', caption: 'Photo 2' },
      ];

      mockPhotoModel.exec.mockResolvedValueOnce(mockPhotos);

      const result = await service.findByPoint('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockPhotos);
      expect(mockPhotoModel.find).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid point ID', async () => {
      await expect(service.findByPoint('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('uploadPhoto', () => {
    it('should upload a photo successfully', async () => {
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
        isPublic: true,
      };

      const mockUploadedFile = {
        originalUrl: 'https://storage.example.com/original/photo-123.jpg',
        thumbnailUrl: 'https://storage.example.com/thumbnail/photo-123.jpg',
        mediumUrl: 'https://storage.example.com/medium/photo-123.jpg',
        largeUrl: 'https://storage.example.com/large/photo-123.jpg',
        filename: 'photo-123.jpg',
        originalName: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        width: 1920,
        height: 1080,
      };

      const mockSavedPhoto = {
        id: 'photo-123',
        ...uploadDto,
        ...mockUploadedFile,
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

      expect(mockUploadService.uploadImage).toHaveBeenCalledWith(mockFile);
      expect(mockConstructor).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(mockSavedPhoto);
    });
  });

  describe('findOne', () => {
    it('should return a photo and increment view count', async () => {
      const mockPhoto = {
        id: 'photo-123',
        caption: 'Test photo',
        viewCount: 10,
      };

      mockPhotoModel.exec.mockResolvedValueOnce(mockPhoto);
      mockPhotoModel.findByIdAndUpdate.mockResolvedValueOnce({});

      const result = await service.findOne('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockPhoto);
      expect(mockPhotoModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { $inc: { viewCount: 1 } },
      );
    });

    it('should throw NotFoundException for non-existent photo', async () => {
      mockPhotoModel.exec.mockResolvedValueOnce(null);

      await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('toggleLike', () => {
    it('should toggle like on a photo', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const photoId = '507f191e810c19729de860ea';

      const mockPhoto = {
        id: photoId,
        likedBy: [],
        likesCount: 0,
      };

      mockPhoto.likedBy.some = jest.fn().mockReturnValue(false);

      mockPhotoModel.findById = jest.fn().mockResolvedValueOnce(mockPhoto);
      mockPhotoModel.findByIdAndUpdate.mockResolvedValueOnce({});

      const result = await service.toggleLike(photoId, userId);

      expect(result).toEqual({ liked: true, count: 1 });
      expect(mockPhotoModel.findByIdAndUpdate).toHaveBeenCalledWith(photoId, {
        $addToSet: { likedBy: expect.any(Types.ObjectId) },
        $inc: { likesCount: 1 },
      });
    });
  });
});
