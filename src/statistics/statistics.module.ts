import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Photo, PhotoSchema } from '../photos/schemas/photo.schema';
import {
  PointOfInterest,
  PointOfInterestSchema,
} from '../points/schemas/point-of-interest.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Photo.name, schema: PhotoSchema },
      { name: PointOfInterest.name, schema: PointOfInterestSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
