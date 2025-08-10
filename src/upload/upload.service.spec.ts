import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UploadService } from './upload.service';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as sharp from 'sharp';

// Mock sharp
jest.mock('sharp');
jest.mock('fs');

describe('UploadService', () => {
  let service: UploadService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'UPLOAD_PATH') return './test-uploads';
      if (key === 'BASE_URL') return 'http://test.com';
      return null;
    }),
  };

  const mockFile = {
    fieldname: 'image',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('test'),
    size: 1024,
  } as Express.Multer.File;

  const mockSharpInstance = {
    metadata: jest.fn().mockResolvedValue({ width: 1920, height: 1080 }),
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Mock fs methods
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.unlinkSync as jest.Mock).mockImplementation(() => {});
    
    // Mock sharp
    (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('constructor', () => {
    it('should create upload directories on initialization', () => {
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('original'),
        { recursive: true }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('thumbnail'),
        { recursive: true }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('medium'),
        { recursive: true }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('large'),
        { recursive: true }
      );
    });

    it('should use default values if config not provided', () => {
      jest.clearAllMocks(); // Clear all mocks before this test
      
      const mockConfigWithoutValues = {
        get: jest.fn().mockReturnValue(null),
      };

      new UploadService(mockConfigWithoutValues as unknown as ConfigService);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('uploads/original'),
        expect.any(Object)
      );
    });
  });

  describe('uploadImage', () => {
    it('should upload and process image', async () => {
      const result = await service.uploadImage(mockFile);

      expect(sharp).toHaveBeenCalledWith(mockFile.buffer);
      expect(mockSharpInstance.toFile).toHaveBeenCalledTimes(4); // original + 3 sizes
      
      expect(result).toMatchObject({
        originalUrl: expect.stringContaining('http://test.com/uploads/original/'),
        thumbnailUrl: expect.stringContaining('http://test.com/uploads/thumbnail/'),
        mediumUrl: expect.stringContaining('http://test.com/uploads/medium/'),
        largeUrl: expect.stringContaining('http://test.com/uploads/large/'),
        filename: expect.stringMatching(/^[0-9a-f-]+\.jpg$/),
        originalName: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        width: 1920,
        height: 1080,
      });
    });

    it('should create resized versions', async () => {
      await service.uploadImage(mockFile);

      // Check thumbnail resize
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(200, 200, {
        fit: 'cover',
        position: 'center',
      });

      // Check medium resize
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(800, 800, {
        fit: 'inside',
        withoutEnlargement: true,
      });

      // Check large resize
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(1920, 1920, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    });

    it('should throw BadRequestException on error', async () => {
      mockSharpInstance.metadata.mockRejectedValue(new Error('Processing error'));

      await expect(service.uploadImage(mockFile)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('deleteImage', () => {
    it('should delete all image sizes', async () => {
      const filename = 'test-image.jpg';
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await service.deleteImage(filename);

      expect(fs.unlinkSync).toHaveBeenCalledTimes(4);
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('original/test-image.jpg')
      );
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('thumbnail/test-image.jpg')
      );
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('medium/test-image.jpg')
      );
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('large/test-image.jpg')
      );
    });

    it('should skip non-existent files', async () => {
      const filename = 'test-image.jpg';
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await service.deleteImage(filename);

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('getImagePath', () => {
    it('should return correct path for image size', () => {
      const filename = 'test-image.jpg';

      expect(service.getImagePath(filename)).toContain('original/test-image.jpg');
      expect(service.getImagePath(filename, 'thumbnail')).toContain(
        'thumbnail/test-image.jpg'
      );
      expect(service.getImagePath(filename, 'medium')).toContain(
        'medium/test-image.jpg'
      );
      expect(service.getImagePath(filename, 'large')).toContain(
        'large/test-image.jpg'
      );
    });
  });
});
