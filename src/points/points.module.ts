import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';
import {
  PointOfInterest,
  PointOfInterestSchema,
} from './schemas/point-of-interest.schema';
import { GooglePlacesModule } from '../google-places/google-places.module';
import { PhotosModule } from '../photos/photos.module';
import { UploadModule } from '../upload/upload.module';
import { OverpassModule } from '../overpass/overpass.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PointOfInterest.name, schema: PointOfInterestSchema },
    ]),
    GooglePlacesModule,
    PhotosModule,
    UploadModule,
    OverpassModule,
    UsersModule,
  ],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
