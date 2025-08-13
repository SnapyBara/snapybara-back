import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadService, UploadedFile } from './upload.service';
import { CloudinaryUploadService } from './cloudinary-upload.service';

@Injectable()
export class HybridUploadService {
  private readonly useCloudinary: boolean;
  private _localImagePath: string;

  constructor(
    private uploadService: UploadService,
    private cloudinaryUploadService: CloudinaryUploadService,
    private configService: ConfigService,
  ) {
    this.useCloudinary = !!this.configService.get<string>(
      'CLOUDINARY_CLOUD_NAME',
    );
  }

  async uploadImage(file: Express.Multer.File): Promise<UploadedFile> {
    if (this.useCloudinary) {
      return this.cloudinaryUploadService.uploadImage(file);
    }
    return this.uploadService.uploadImage(file);
  }

  async deleteImage(identifier: string): Promise<void> {
    if (this.useCloudinary) {
      const publicId = this.cloudinaryUploadService.extractPublicId(identifier);
      if (publicId) {
        return this.cloudinaryUploadService.deleteImage(publicId);
      }
    }
    return this.uploadService.deleteImage(identifier);
  }

  async migrateToCloudinary(
    localImagePath: string,
  ): Promise<UploadedFile | null> {
    this._localImagePath = localImagePath;
    try {
      return null;
    } catch (error) {
      console.error('Migration error:', error);
      return null;
    }
  }
}
