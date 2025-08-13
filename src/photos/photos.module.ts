import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PhotosService } from './photos.service';
import { PhotosController } from './photos.controller';
import { Photo, PhotoSchema } from './schemas/photo.schema';
import { UploadModule } from '../upload/upload.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Photo.name, schema: PhotoSchema }]),
    UploadModule,
    UsersModule,
  ],
  controllers: [PhotosController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
