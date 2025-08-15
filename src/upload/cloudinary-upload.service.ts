import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import * as streamifier from 'streamifier';
import { UploadedFile } from './upload.service';
import 'multer';

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
      });

      const thumbnailUrl = this.getTransformedUrl(uploadResult.public_id, {
        width: 200,
        height: 200,
        crop: 'fill',
        gravity: 'auto',
        quality: 'auto',
      });

      const mediumUrl = this.getTransformedUrl(uploadResult.public_id, {
        width: 800,
        height: 800,
        crop: 'limit',
        quality: 'auto:good',
      });

      const largeUrl = this.getTransformedUrl(uploadResult.public_id, {
        width: 1920,
        height: 1920,
        crop: 'limit',
        quality: 'auto:good',
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
          resource_type: 'image',
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
    const parts: string[] = [];

    if (transformation.width) parts.push(`w_${transformation.width}`);
    if (transformation.height) parts.push(`h_${transformation.height}`);
    if (transformation.crop) parts.push(`c_${transformation.crop}`);
    if (transformation.gravity) parts.push(`g_${transformation.gravity}`);
    if (transformation.quality) parts.push(`q_${transformation.quality}`);

    parts.push('f_auto');

    const transformationString = parts.join(',');

    return `https://res.cloudinary.com/${this.configService.get('CLOUDINARY_CLOUD_NAME')}/image/upload/${transformationString}/${publicId}`;
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await this.cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw new BadRequestException('Failed to delete image from Cloudinary');
    }
  }

  extractPublicId(url: string): string | null {
    const matches = url.match(/\/v\d+\/(.+)\./);
    return matches ? matches[1] : null;
  }
}
