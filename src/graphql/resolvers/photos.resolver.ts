import { Resolver, Query, Args } from '@nestjs/graphql';
import { PhotosService } from '../../photos/photos.service';
import { Photo } from '../types/point.type';

@Resolver(() => Photo)
export class PhotosResolver {
  constructor(private photosService: PhotosService) {}

  @Query(() => [Photo], { name: 'recentPhotos' })
  async getRecentPhotos(@Args('limit') limit: number = 20) {
    return this.photosService.getRecentPhotos(limit);
  }

  @Query(() => [Photo], { name: 'topPhotos' })
  async getTopPhotos(@Args('limit') limit: number = 10) {
    return this.photosService.getTopPhotos(limit);
  }
}
