import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { PointOfInterest, PointOfInterestSchema } from '../points/schemas/point-of-interest.schema';
import { Photo, PhotoSchema } from '../photos/schemas/photo.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Collection, CollectionSchema } from '../collections/schemas/collection.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PointOfInterest.name, schema: PointOfInterestSchema },
      { name: Photo.name, schema: PhotoSchema },
      { name: User.name, schema: UserSchema },
      { name: Collection.name, schema: CollectionSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
