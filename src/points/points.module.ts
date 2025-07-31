import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';
import {
  PointOfInterest,
  PointOfInterestSchema,
} from './schemas/point-of-interest.schema';
import { GooglePlacesModule } from '../google-places/google-places.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PointOfInterest.name, schema: PointOfInterestSchema },
    ]),
    GooglePlacesModule,
  ],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
