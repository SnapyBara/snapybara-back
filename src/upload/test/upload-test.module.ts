import { Module } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { PhotosController } from '../../photos/photos.controller';
import { PhotosService } from '../../photos/photos.service';
import { UploadService } from '../upload.service';
import { HybridUploadService } from '../hybrid-upload.service';
import { CloudinaryUploadService } from '../cloudinary-upload.service';
import { Photo, PhotoSchema } from '../../photos/schemas/photo.schema';
import {
  PointOfInterest,
  PointOfInterestSchema,
} from '../../points/schemas/point-of-interest.schema';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';

// Mock Model pour Photo
const mockPhotoModel = {
  new: jest.fn().mockImplementation((dto) => ({
    ...dto,
    _id: '507f1f77bcf86cd799439011',
    save: jest.fn().mockResolvedValue({
      ...dto,
      _id: '507f1f77bcf86cd799439011',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  })),
  constructor: jest.fn().mockImplementation((dto) => ({
    ...dto,
    _id: '507f1f77bcf86cd799439011',
    save: jest.fn().mockResolvedValue({
      ...dto,
      _id: '507f1f77bcf86cd799439011',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  })),
  find: jest.fn().mockReturnThis(),
  findOne: jest.fn().mockReturnThis(),
  findById: jest.fn().mockReturnThis(),
  findByIdAndUpdate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(null),
  countDocuments: jest.fn().mockResolvedValue(0),
};

export const MockPhotosService = {
  create: jest.fn().mockResolvedValue({
    _id: '507f1f77bcf86cd799439011',
    url: 'https://test.com/test.jpg',
    userId: 'user-mongo-id',
    pointId: '507f1f77bcf86cd799439011',
    status: 'pending',
  }),
  uploadPhoto: jest.fn().mockImplementation((file, dto, userId) => {
    // Check if filename has path traversal attempts - the validator should have rejected these
    const filename = file?.originalname || '';
    if (
      filename.includes('..') ||
      filename.includes('%00') ||
      filename.includes('\x00')
    ) {
      throw new Error('File validation should have rejected this');
    }

    return Promise.resolve({
      _id: '507f1f77bcf86cd799439011',
      url: 'https://test.com/test.jpg',
      thumbnailUrl: 'https://test.com/test-thumb.jpg',
      mediumUrl: 'https://test.com/test-medium.jpg',
      largeUrl: 'https://test.com/test-large.jpg',
      filename: 'test.jpg',
      originalName: 'test.jpg',
      size: 1000,
      mimeType: 'image/jpeg',
      width: 800,
      height: 600,
      userId: 'user-mongo-id',
      pointId: '507f1f77bcf86cd799439011',
      status: 'approved',
      isPublic: true,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }),
  findAll: jest.fn().mockResolvedValue({
    data: [],
    total: 0,
    page: 1,
    limit: 20,
  }),
  findOne: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue(null),
  remove: jest.fn().mockResolvedValue(undefined),
  toggleLike: jest.fn().mockResolvedValue({ liked: true, count: 1 }),
  getTopPhotos: jest.fn().mockResolvedValue([]),
  getRecentPhotos: jest.fn().mockResolvedValue([]),
  findByPoint: jest.fn().mockResolvedValue([]),
  findBySupabaseUserId: jest.fn().mockResolvedValue({
    data: [],
    total: 0,
    page: 1,
    limit: 20,
  }),
};

export const MockSupabaseService = {
  client: {
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest
          .fn()
          .mockResolvedValue({ data: { path: 'test-path.jpg' }, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://test.com/test.jpg' },
        }),
      }),
    },
  },
  getClient: jest.fn().mockReturnValue({
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest
          .fn()
          .mockResolvedValue({ data: { path: 'test-path.jpg' }, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://test.com/test.jpg' },
        }),
      }),
    },
  }),
};

export const MockUploadService = {
  uploadImage: jest.fn().mockResolvedValue({
    originalUrl: 'https://test.com/test.jpg',
    thumbnailUrl: 'https://test.com/test-thumb.jpg',
    mediumUrl: 'https://test.com/test-medium.jpg',
    largeUrl: 'https://test.com/test-large.jpg',
    filename: 'test.jpg',
    originalName: 'test.jpg',
    size: 1000,
    mimeType: 'image/jpeg',
    width: 800,
    height: 600,
  }),
  validateFile: jest.fn(),
  sanitizeFilename: jest.fn().mockImplementation((filename) => filename),
  isValidImageBuffer: jest.fn().mockResolvedValue(true),
  deleteImage: jest.fn().mockResolvedValue(undefined),
  getImagePath: jest.fn().mockReturnValue('/path/to/image'),
};

export const MockCloudinaryUploadService = {
  uploadImage: jest.fn().mockResolvedValue({
    originalUrl: 'https://res.cloudinary.com/test/test.jpg',
    thumbnailUrl: 'https://res.cloudinary.com/test/test-thumb.jpg',
    mediumUrl: 'https://res.cloudinary.com/test/test-medium.jpg',
    largeUrl: 'https://res.cloudinary.com/test/test-large.jpg',
    filename: 'test',
    originalName: 'test.jpg',
    size: 1000,
    mimeType: 'image/jpeg',
    width: 800,
    height: 600,
  }),
  deleteImage: jest.fn().mockResolvedValue(undefined),
  extractPublicId: jest.fn().mockReturnValue('test'),
};

export const MockHybridUploadService = {
  uploadImage: jest.fn().mockResolvedValue({
    originalUrl: 'https://test.com/test.jpg',
    thumbnailUrl: 'https://test.com/test-thumb.jpg',
    mediumUrl: 'https://test.com/test-medium.jpg',
    largeUrl: 'https://test.com/test-large.jpg',
    filename: 'test.jpg',
    originalName: 'test.jpg',
    size: 1000,
    mimeType: 'image/jpeg',
    width: 800,
    height: 600,
  }),
  deleteImage: jest.fn().mockResolvedValue(undefined),
};

export const MockUsersService = {
  findBySupabaseId: jest.fn().mockResolvedValue({
    _id: 'user-mongo-id',
    supabaseId: 'test-user-id',
    email: 'test@example.com',
  }),
  findById: jest.fn().mockResolvedValue({
    _id: 'user-mongo-id',
    supabaseId: 'test-user-id',
    email: 'test@example.com',
  }),
  create: jest.fn().mockResolvedValue({
    _id: 'user-mongo-id',
    supabaseId: 'test-user-id',
    email: 'test@example.com',
  }),
};

export const MockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    const config = {
      UPLOAD_PATH: './test-uploads',
      BASE_URL: 'http://localhost:3000',
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
    };
    return config[key];
  }),
};

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  ],
  controllers: [PhotosController],
  providers: [
    {
      provide: PhotosService,
      useValue: MockPhotosService,
    },
    {
      provide: getModelToken(Photo.name),
      useValue: mockPhotoModel,
    },
    {
      provide: HybridUploadService,
      useValue: MockHybridUploadService,
    },
    {
      provide: UploadService,
      useValue: MockUploadService,
    },
    {
      provide: CloudinaryUploadService,
      useValue: MockCloudinaryUploadService,
    },
    {
      provide: ConfigService,
      useValue: MockConfigService,
    },
    {
      provide: 'SupabaseService',
      useValue: MockSupabaseService,
    },
    {
      provide: UsersService,
      useValue: MockUsersService,
    },
    {
      provide: 'CLOUDINARY',
      useValue: {
        uploader: {
          upload_stream: jest.fn(),
          destroy: jest.fn(),
        },
      },
    },
  ],
})
export class UploadTestModule {}
