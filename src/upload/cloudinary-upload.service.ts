import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import * as streamifier from 'streamifier';
import { UploadedFile } from './upload.service';

@Injectable()
export class CloudinaryUploadService {
  constructor(
    @Inject('CLOUDINARY') private cloudinary,
    private configService: ConfigService,
  ) {}

  async uploadImage(file: Express.Multer.File): Promise<UploadedFile> {
    try {
      const uploadResult = await this.uploadToCloudinary(file, {
        folder: 'snapybara/original',
        quality: 'auto:best',
        format: 'auto',
      });

      // Get different size URLs using Cloudinary transformations
      const thumbnailUrl = this.getTransformedUrl(uploadResult.public_id, {
        width: 200,
        height: 200,
        crop: 'fill',
        gravity: 'auto',
        quality: 'auto',
        format: 'auto',
      });

      const mediumUrl = this.getTransformedUrl(uploadResult.public_id, {
        width: 800,
        height: 800,
        crop: 'limit',
        quality: 'auto:good',
        format: 'auto',
      });

      const largeUrl = this.getTransformedUrl(uploadResult.public_id, {
        width: 1920,
        height: 1920,
        crop: 'limit',
        quality: 'auto:good',
        format: 'auto',
      });

      return {
        originalUrl: uploadResult.secure_url,
        thumbnailUrl,
        mediumUrl,
        largeUrl,
        filename: uploadResult.public_id,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        width: uploadResult.width,
        height: uploadResult.height,
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new BadRequestException('Failed to upload image to Cloudinary');
    }
  }

  private uploadToCloudinary(
    file: Express.Multer.File,
    options: any,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          ...options,
          resource_type: 'auto',
        },
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  private getTransformedUrl(publicId: string, transformation: any): string {
    return this.cloudinary.url(publicId, {
      secure: true,
      transformation: [transformation],
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await this.cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw new BadRequestException('Failed to delete image from Cloudinary');
    }
  }

  // Méthode utilitaire pour extraire le public_id depuis une URL Cloudinary
  extractPublicId(url: string): string | null {
    const matches = url.match(/\/v\d+\/(.+)\./);
    return matches ? matches[1] : null;
  }
}
