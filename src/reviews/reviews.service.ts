import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { PointsService } from '../points/points.service';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name)
    private reviewModel: Model<ReviewDocument>,
    @Inject(forwardRef(() => PointsService))
    private pointsService: PointsService,
  ) {}

  async create(
    createReviewDto: CreateReviewDto,
    userId: string,
  ): Promise<Review> {
    // Check if user already reviewed this point
    const existingReview = await this.reviewModel.findOne({
      userId: userId,
      pointId: new Types.ObjectId(createReviewDto.pointId),
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this point');
    }

    const createdReview = new this.reviewModel({
      ...createReviewDto,
      userId: userId,
      pointId: new Types.ObjectId(createReviewDto.pointId),
    });

    const savedReview = await createdReview.save();

    await this.updatePointStatistics(createReviewDto.pointId);

    return savedReview;
  }

  private async updatePointStatistics(pointId: string): Promise<void> {
    try {
      const stats = await this.getPointStatistics(pointId);
      await this.pointsService.updatePointStatistics(pointId, {
        averageRating: stats.averageRating,
        totalReviews: stats.totalReviews,
      });
    } catch (error) {
      console.error('Error updating point statistics:', error);
    }
  }

  async findAll(filters: {
    pointId?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Review[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...queryFilters } = filters;
    const skip = (page - 1) * limit;

    const query: any = { isActive: true, status: 'published' };

    if (queryFilters.pointId) {
      query.pointId = new Types.ObjectId(queryFilters.pointId);
    }

    if (queryFilters.userId) {
      query.userId = queryFilters.userId;
    }

    const [data, total] = await Promise.all([
      this.reviewModel
        .find(query)
        .sort({ helpfulCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'username profilePicture level')
        .exec(),
      this.reviewModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Review> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel
      .findById(id)
      .populate('userId', 'username profilePicture level')
      .populate('pointId', 'name category')
      .exec();

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async update(
    id: string,
    updateReviewDto: UpdateReviewDto,
    userId: string,
  ): Promise<Review> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new BadRequestException('You can only update your own reviews');
    }

    const updated = await this.reviewModel
      .findByIdAndUpdate(
        id,
        { ...updateReviewDto, updatedAt: new Date() },
        { new: true },
      )
      .populate('userId', 'username profilePicture level')
      .exec();

    if (!updated) {
      throw new NotFoundException('Review not found');
    }
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new BadRequestException('You can only delete your own reviews');
    }

    await this.reviewModel.findByIdAndUpdate(id, {
      isActive: false,
      updatedAt: new Date(),
    });
  }

  async toggleHelpful(
    reviewId: string,
    userId: string,
  ): Promise<{ helpful: boolean; count: number }> {
    if (!Types.ObjectId.isValid(reviewId)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel.findById(reviewId);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const isHelpful = review.helpfulBy.includes(userId);

    if (isHelpful) {
      await this.reviewModel.findByIdAndUpdate(reviewId, {
        $pull: { helpfulBy: userId },
        $inc: { helpfulCount: -1 },
      });
      return { helpful: false, count: review.helpfulCount - 1 };
    } else {
      await this.reviewModel.findByIdAndUpdate(reviewId, {
        $addToSet: { helpfulBy: userId },
        $inc: { helpfulCount: 1 },
      });
      return { helpful: true, count: review.helpfulCount + 1 };
    }
  }

  async getPointStatistics(pointId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<string, number>;
  }> {
    const reviews = await this.reviewModel.find({
      pointId: new Types.ObjectId(pointId),
      isActive: true,
      status: 'published',
    });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      };
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    const ratingDistribution = reviews.reduce(
      (dist, review) => {
        dist[review.rating.toString()] =
          (dist[review.rating.toString()] || 0) + 1;
        return dist;
      },
      {} as Record<string, number>,
    );

    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: reviews.length,
      ratingDistribution,
    };
  }
}
