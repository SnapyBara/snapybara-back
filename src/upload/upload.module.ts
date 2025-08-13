import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from './upload.service';
import { CloudinaryUploadService } from './cloudinary-upload.service';
import { HybridUploadService } from './hybrid-upload.service';
import { CloudinaryProvider } from '../config/cloudinary.config';

@Module({
  imports: [ConfigModule],
  providers: [
    UploadService,
    CloudinaryUploadService,
    HybridUploadService,
    CloudinaryProvider,
  ],
  exports: [UploadService, CloudinaryUploadService, HybridUploadService],
})
export class UploadModule {}
