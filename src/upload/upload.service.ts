import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly uploadDir: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(private configService: ConfigService) {
    this.uploadDir = this.configService.get('UPLOAD_DIR') || './uploads';
    this.maxFileSize = parseInt(
      this.configService.get('MAX_FILE_SIZE') || '10485760',
    ); // 10MB
    this.allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/jpg',
    ];
  }

  async uploadPhoto(
    file: Express.Multer.File,
    userId: string,
  ): Promise<{
    url: string;
    thumbnailUrl: string;
    mediumUrl: string;
    metadata: any;
  }> {
    // Validate file
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException('File too large');
    }

    const filename = `${userId}-${uuidv4()}`;
    const uploadPath = path.join(this.uploadDir, 'photos', userId);
    await fs.mkdir(uploadPath, { recursive: true });
    const image = sharp(file.buffer);
    const metadata = await image.metadata();

    const [original, thumbnail, medium] = await Promise.all([
      image
        .jpeg({ quality: 90 })
        .toFile(path.join(uploadPath, `${filename}.jpg`)),
      image
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(path.join(uploadPath, `${filename}-thumb.jpg`)),

      image
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(path.join(uploadPath, `${filename}-medium.jpg`)),
    ]);
    const exifData = await this.extractExifData(file.buffer);

    // Generate URLs (in production, these would be CDN URLs)
    const baseUrl =
      this.configService.get('BASE_URL') || 'http://localhost:3000';
    const url = `${baseUrl}/uploads/photos/${userId}/${filename}.jpg`;
    const thumbnailUrl = `${baseUrl}/uploads/photos/${userId}/${filename}-thumb.jpg`;
    const mediumUrl = `${baseUrl}/uploads/photos/${userId}/${filename}-medium.jpg`;

    return {
      url,
      thumbnailUrl,
      mediumUrl,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: file.size,
        ...exifData,
      },
    };
  }

  async uploadAvatar(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }

    const filename = `${userId}-avatar-${Date.now()}.jpg`;
    const uploadPath = path.join(this.uploadDir, 'avatars');

    await fs.mkdir(uploadPath, { recursive: true });

    await sharp(file.buffer)
      .resize(400, 400, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toFile(path.join(uploadPath, filename));

    const baseUrl =
      this.configService.get('BASE_URL') || 'http://localhost:3000';
    return `${baseUrl}/uploads/avatars/${filename}`;
  }

  private async extractExifData(buffer: Buffer): Promise<any> {
    try {
      const metadata = await sharp(buffer).metadata();

      // Sharp doesn't provide detailed EXIF data
      // In production, use a dedicated EXIF parser
      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        density: metadata.density,
        hasProfile: metadata.hasProfile,
        hasAlpha: metadata.hasAlpha,
      };
    } catch (error) {
      console.error('Error extracting EXIF data:', error);
      return {};
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.uploadDir, filePath);
      await fs.unlink(fullPath);
    } catch (error) {
      // Log error but don't throw
      console.error('Error deleting file:', error);
    }
  }
}
