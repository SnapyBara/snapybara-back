import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PointOfInterest,
  PointOfInterestDocument,
} from './schemas/point-of-interest.schema';
import { CreatePointOfInterestDto } from './dto/create-point.dto';
import { UpdatePointOfInterestDto } from './dto/update-point.dto';
import { SearchPointsDto } from './dto/search-points.dto';

@Injectable()
export class PointsService {
  constructor(
    @InjectModel(PointOfInterest.name)
    private pointModel: Model<PointOfInterestDocument>,
  ) {}

  async create(
    createPointDto: CreatePointOfInterestDto,
    userId: string,
  ): Promise<PointOfInterest> {
    const createdPoint = new this.pointModel({
      ...createPointDto,
      userId: new Types.ObjectId(userId),
      status: 'pending',
      statistics: {
        averageRating: 0,
        totalReviews: 0,
        totalPhotos: 0,
        totalLikes: 0,
      },
    });
    return createdPoint.save();
  }

  async findAll(searchDto: SearchPointsDto): Promise<{
    data: PointOfInterest[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...filters } = searchDto;
    const skip = (page - 1) * limit;

    const query: any = { isActive: true, status: 'approved' };

    // Location-based search
    if (filters.latitude && filters.longitude && filters.radius) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [filters.longitude, filters.latitude],
          },
          $maxDistance: filters.radius * 1000, // Convert km to meters
        },
      };
    }

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      query.category = { $in: filters.categories };
    }

    // Rating filter
    if (filters.minRating) {
      query['statistics.averageRating'] = { $gte: filters.minRating };
    }

    // Has photos filter
    if (filters.hasPhotos) {
      query['statistics.totalPhotos'] = { $gt: 0 };
    }

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { tags: { $regex: filters.search, $options: 'i' } },
      ];
    }

    let sort: any = {};
    switch (filters.sortBy) {
      case 'rating':
        sort = { 'statistics.averageRating': -1 };
        break;
      case 'recent':
        sort = { createdAt: -1 };
        break;
      case 'popular':
        sort = { viewCount: -1 };
        break;
      default:
        if (filters.latitude && filters.longitude) {
        } else {
          sort = { createdAt: -1 };
        }
    }

    const [data, total] = await Promise.all([
      this.pointModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'username profilePicture')
        .exec(),
      this.pointModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<PointOfInterest> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid point ID');
    }

    const point = await this.pointModel
      .findById(id)
      .populate('userId', 'username profilePicture')
      .exec();

    if (!point) {
      throw new NotFoundException('Point not found');
    }

    await this.pointModel.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

    return point;
  }

  async findByUser(userId: string): Promise<PointOfInterest[]> {
    return this.pointModel
      .find({ userId: new Types.ObjectId(userId), isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(
    id: string,
    updatePointDto: UpdatePointOfInterestDto,
    userId: string,
  ): Promise<PointOfInterest> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid point ID');
    }

    const point = await this.pointModel.findById(id);
    if (!point) {
      throw new NotFoundException('Point not found');
    }

    if (point.userId.toString() !== userId) {
      throw new BadRequestException('You can only update your own points');
    }

    const updated = await this.pointModel
      .findByIdAndUpdate(
        id,
        { ...updatePointDto, updatedAt: new Date() },
        { new: true },
      )
      .populate('userId', 'username profilePicture')
      .exec();

    if (!updated) {
      throw new NotFoundException('Point not found');
    }

    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid point ID');
    }

    const point = await this.pointModel.findById(id);
    if (!point) {
      throw new NotFoundException('Point not found');
    }

    if (point.userId.toString() !== userId) {
      throw new BadRequestException('You can only delete your own points');
    }

    await this.pointModel.findByIdAndUpdate(id, {
      isActive: false,
      updatedAt: new Date(),
    });
  }

  async updateStatistics(pointId: string): Promise<void> {
    // This would be called after adding/removing photos or reviews
    // Implementation would calculate and update statistics
  }

  async findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
  ): Promise<PointOfInterest[]> {
    return this.pointModel
      .find({
        isActive: true,
        status: 'approved',
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radiusKm * 1000,
          },
        },
      })
      .limit(50)
      .populate('userId', 'username profilePicture')
      .exec();
  }
}
