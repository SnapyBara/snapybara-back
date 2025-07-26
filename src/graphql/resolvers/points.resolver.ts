import { Resolver, Query, Args, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PointsService } from '../../points/points.service';
import { PhotosService } from '../../photos/photos.service';
import { ReviewsService } from '../../reviews/reviews.service';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import {
  PointOfInterest,
  Photo,
  Review,
  ReviewStatistics,
} from '../types/point.type';
import { UserActivity } from '../types/activity.type';

@Resolver(() => PointOfInterest)
export class PointsResolver {
  constructor(
    private pointsService: PointsService,
    private photosService: PhotosService,
    private reviewsService: ReviewsService,
  ) {}

  @Query(() => [PointOfInterest], { name: 'pointsWithFullDetails' })
  async getPointsWithFullDetails(
    @Args('latitude') latitude: number,
    @Args('longitude') longitude: number,
    @Args('radius') radius: number,
    @Args('includePhotos') includePhotos: boolean = true,
    @Args('includeReviews') includeReviews: boolean = true,
  ) {
    const points = await this.pointsService.findNearby(
      latitude,
      longitude,
      radius,
    );

    if (!includePhotos && !includeReviews) {
      return points;
    }

    const enrichedPoints = await Promise.all(
      points.map(async (point) => {
        const result: any = { ...(point as any) };

        if (includePhotos && point._id) {
          const photos = await this.photosService.findAll({
            pointId: point._id.toString(),
            limit: 5,
          });
          result.photos = photos.data;
        }

        if (includeReviews && point._id) {
          const reviews = await this.reviewsService.findAll({
            pointId: point._id.toString(),
            limit: 5,
          });
          result.reviews = reviews.data;
          result.statistics = await this.reviewsService.getPointStatistics(
            point._id.toString(),
          );
        }

        return result;
      }),
    );

    return enrichedPoints;
  }

  @Query(() => [UserActivity], { name: 'userActivityFeed' })
  @UseGuards(SupabaseAuthGuard)
  getUserActivityFeed(
    @Args('userId') userId: string,
    @Args('page') _page: number = 1,
    @Args('limit') _limit: number = 20,
  ): UserActivity[] {
    // Complex query combining user's friends' activities
    // This would be implemented with proper friend system
    return [];
  }

  @ResolveField(() => [Photo])
  async getPhotos(@Parent() point: any) {
    const pointId = point._id || point.id;
    if (!pointId) return [];

    const result = await this.photosService.findAll({
      pointId: pointId.toString(),
      limit: 10,
    });
    return result.data;
  }

  @ResolveField(() => [Review])
  async getReviews(@Parent() point: any) {
    const pointId = point._id || point.id;
    if (!pointId) return [];

    const result = await this.reviewsService.findAll({
      pointId: pointId.toString(),
      limit: 10,
    });
    return result.data;
  }

  @ResolveField(() => ReviewStatistics, { nullable: true })
  async getStatistics(@Parent() point: any) {
    const pointId = point._id || point.id;
    if (!pointId) return null;

    return this.reviewsService.getPointStatistics(pointId.toString());
  }
}
