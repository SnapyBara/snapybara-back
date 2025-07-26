import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Photo, PhotoDocument } from '../photos/schemas/photo.schema';
import {
  PointOfInterest,
  PointOfInterestDocument,
} from '../points/schemas/point-of-interest.schema';
import { Review, ReviewDocument } from '../reviews/schemas/review.schema';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Photo.name) private photoModel: Model<PhotoDocument>,
    @InjectModel(PointOfInterest.name)
    private pointModel: Model<PointOfInterestDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
  ) {}

  async getUserStatistics(userId: string): Promise<{
    totalPhotos: number;
    totalPoints: number;
    totalReviews: number;
    totalLikes: number;
    level: number;
    points: number;
    rank: number;
    recentActivity: any[];
  }> {
    const userObjectId = new Types.ObjectId(userId);

    const [user, totalPhotos, totalPoints, totalReviews, photosLikes] =
      await Promise.all([
        this.userModel.findById(userObjectId),
        this.photoModel.countDocuments({
          userId: userObjectId,
          isActive: true,
        }),
        this.pointModel.countDocuments({
          userId: userObjectId,
          isActive: true,
        }),
        this.reviewModel.countDocuments({
          userId: userObjectId,
          isActive: true,
        }),
        this.photoModel.aggregate([
          { $match: { userId: userObjectId, isActive: true } },
          { $group: { _id: null, totalLikes: { $sum: '$likesCount' } } },
        ]),
      ]);

    const totalLikes = photosLikes[0]?.totalLikes || 0;

    // Calculate user rank based on points
    const rank =
      (await this.userModel.countDocuments({
        points: { $gt: user?.points || 0 },
      })) + 1;

    // Get recent activity
    const recentActivity = await this.getRecentUserActivity(userId);

    return {
      totalPhotos,
      totalPoints,
      totalReviews,
      totalLikes,
      level: user?.level || 1,
      points: user?.points || 0,
      rank,
      recentActivity,
    };
  }

  async getGlobalStatistics(): Promise<{
    totalUsers: number;
    totalPoints: number;
    totalPhotos: number;
    totalReviews: number;
    topCategories: any[];
    mostActiveUsers: any[];
    trendingPoints: any[];
  }> {
    const [
      totalUsers,
      totalPoints,
      totalPhotos,
      totalReviews,
      topCategories,
      mostActiveUsers,
      trendingPoints,
    ] = await Promise.all([
      this.userModel.countDocuments({ isActive: true }),
      this.pointModel.countDocuments({ isActive: true, status: 'approved' }),
      this.photoModel.countDocuments({ isActive: true, status: 'approved' }),
      this.reviewModel.countDocuments({ isActive: true }),
      this.getTopCategories(),
      this.getMostActiveUsers(),
      this.getTrendingPoints(),
    ]);

    return {
      totalUsers,
      totalPoints,
      totalPhotos,
      totalReviews,
      topCategories,
      mostActiveUsers,
      trendingPoints,
    };
  }

  async getLeaderboard(limit: number = 10): Promise<any[]> {
    return this.userModel
      .find({ isActive: true })
      .sort({ points: -1, level: -1 })
      .limit(limit)
      .select('username profilePicture points level photosUploaded')
      .exec();
  }

  private async getRecentUserActivity(userId: string): Promise<any[]> {
    const userObjectId = new Types.ObjectId(userId);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [photos, reviews, points] = await Promise.all([
      this.photoModel
        .find({
          userId: userObjectId,
          createdAt: { $gte: sevenDaysAgo },
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id caption createdAt')
        .lean(),
      this.reviewModel
        .find({
          userId: userObjectId,
          createdAt: { $gte: sevenDaysAgo },
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id rating comment createdAt')
        .lean(),
      this.pointModel
        .find({
          userId: userObjectId,
          createdAt: { $gte: sevenDaysAgo },
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id name category createdAt')
        .lean(),
    ]);

    // Combine and sort by date
    const activities = [
      ...photos.map((p) => ({ type: 'photo', ...p })),
      ...reviews.map((r) => ({ type: 'review', ...r })),
      ...points.map((p) => ({ type: 'point', ...p })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return activities.slice(0, 10);
  }

  private async getTopCategories(): Promise<any[]> {
    return this.pointModel.aggregate([
      { $match: { isActive: true, status: 'approved' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { category: '$_id', count: 1, _id: 0 } },
    ]);
  }

  private async getMostActiveUsers(): Promise<any[]> {
    return this.userModel
      .find({ isActive: true })
      .sort({ photosUploaded: -1 })
      .limit(5)
      .select('username profilePicture photosUploaded points level')
      .exec();
  }

  private async getTrendingPoints(): Promise<any[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.pointModel.aggregate([
      { $match: { isActive: true, status: 'approved' } },
      {
        $lookup: {
          from: 'photos',
          localField: '_id',
          foreignField: 'pointId',
          as: 'recentPhotos',
          pipeline: [
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            { $limit: 1 },
          ],
        },
      },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'pointId',
          as: 'recentReviews',
          pipeline: [
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            { $limit: 1 },
          ],
        },
      },
      {
        $addFields: {
          recentActivity: {
            $add: [{ $size: '$recentPhotos' }, { $size: '$recentReviews' }],
          },
        },
      },
      { $match: { recentActivity: { $gt: 0 } } },
      { $sort: { recentActivity: -1, viewCount: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: 1,
          category: 1,
          latitude: 1,
          longitude: 1,
          recentActivity: 1,
          statistics: 1,
        },
      },
    ]);
  }
}
