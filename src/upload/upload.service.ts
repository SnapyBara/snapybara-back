import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import 'multer';

export interface UploadedFile {
  originalUrl: string;
  thumbnailUrl: string;
  mediumUrl: string;
  largeUrl: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
}

@Injectable()
export class UploadService {
  private readonly uploadPath: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.uploadPath =
      this.configService.get<string>('UPLOAD_PATH') || './uploads';
    this.baseUrl =
      this.configService.get<string>('BASE_URL') || 'http://localhost:3000';

    // Create upload directories if they don't exist
    this.ensureUploadDirectories();
  }

  private ensureUploadDirectories() {
    const directories = [
      path.join(this.uploadPath, 'original'),
      path.join(this.uploadPath, 'thumbnail'),
      path.join(this.uploadPath, 'medium'),
      path.join(this.uploadPath, 'large'),
    ];

    directories.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async uploadImage(file: Express.Multer.File): Promise<UploadedFile> {
    try {
      // Generate unique filename
      const fileExt = path.extname(file.originalname);
      const filename = `${uuidv4()}${fileExt}`;

      // Process and save different sizes
      const image = sharp(file.buffer);
      const metadata = await image.metadata();

      // Save original
      const originalPath = path.join(this.uploadPath, 'original', filename);
      await image.toFile(originalPath);

      // Create thumbnail (200x200)
      const thumbnailPath = path.join(this.uploadPath, 'thumbnail', filename);
      await sharp(file.buffer)
        .resize(200, 200, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      // Create medium size (800x800 max)
      const mediumPath = path.join(this.uploadPath, 'medium', filename);
      await sharp(file.buffer)
        .resize(800, 800, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toFile(mediumPath);

      // Create large size (1920x1920 max)
      const largePath = path.join(this.uploadPath, 'large', filename);
      await sharp(file.buffer)
        .resize(1920, 1920, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 90 })
        .toFile(largePath);

      return {
        originalUrl: `${this.baseUrl}/uploads/original/${filename}`,
        thumbnailUrl: `${this.baseUrl}/uploads/thumbnail/${filename}`,
        mediumUrl: `${this.baseUrl}/uploads/medium/${filename}`,
        largeUrl: `${this.baseUrl}/uploads/large/${filename}`,
        filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error) {
      console.error('Upload error:', error);
      throw new BadRequestException('Failed to upload image');
    }
  }

  async deleteImage(filename: string): Promise<void> {
    const sizes = ['original', 'thumbnail', 'medium', 'large'];

    for (const size of sizes) {
      const filePath = path.join(this.uploadPath, size, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  getImagePath(
    filename: string,
    size: 'original' | 'thumbnail' | 'medium' | 'large' = 'original',
  ): string {
    return path.join(this.uploadPath, size, filename);
  }
}
