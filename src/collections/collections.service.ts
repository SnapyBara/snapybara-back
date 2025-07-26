import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Collection, CollectionDocument } from './schemas/collection.schema';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectModel(Collection.name)
    private collectionModel: Model<CollectionDocument>,
  ) {}

  async create(createCollectionDto: any, userId: string): Promise<Collection> {
    const createdCollection = new this.collectionModel({
      ...createCollectionDto,
      userId: new Types.ObjectId(userId),
    });
    return createdCollection.save();
  }

  async findAll(filters: {
    userId?: string;
    isPublic?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Collection[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...queryFilters } = filters;
    const skip = (page - 1) * limit;

    const query: any = { isActive: true };

    if (queryFilters.userId) {
      query.userId = new Types.ObjectId(queryFilters.userId);
    }

    if (queryFilters.isPublic !== undefined) {
      query.isPublic = queryFilters.isPublic;
    }

    const [data, total] = await Promise.all([
      this.collectionModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'username profilePicture')
        .populate('points', 'name category latitude longitude')
        .exec(),
      this.collectionModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Collection> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid collection ID');
    }

    const collection = await this.collectionModel
      .findById(id)
      .populate('userId', 'username profilePicture')
      .populate('points')
      .exec();

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    return collection;
  }

  async addPoint(
    collectionId: string,
    pointId: string,
    userId: string,
  ): Promise<Collection> {
    const collection = await this.collectionModel.findById(collectionId);

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    if (collection.userId.toString() !== userId) {
      throw new BadRequestException('You can only modify your own collections');
    }

    const pointObjectId = new Types.ObjectId(pointId);

    if (!collection.points.some((p) => p.equals(pointObjectId))) {
      collection.points.push(pointObjectId);
      collection.pointsCount = collection.points.length;
      await collection.save();
    }

    return collection;
  }

  async removePoint(
    collectionId: string,
    pointId: string,
    userId: string,
  ): Promise<Collection> {
    const collection = await this.collectionModel.findById(collectionId);

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    if (collection.userId.toString() !== userId) {
      throw new BadRequestException('You can only modify your own collections');
    }

    collection.points = collection.points.filter(
      (p) => !p.equals(new Types.ObjectId(pointId)),
    );
    collection.pointsCount = collection.points.length;
    await collection.save();

    return collection;
  }

  async toggleFollow(
    collectionId: string,
    userId: string,
  ): Promise<{ following: boolean; count: number }> {
    const collection = await this.collectionModel.findById(collectionId);

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    const userObjectId = new Types.ObjectId(userId);
    const isFollowing = collection.followers.some((f) =>
      f.equals(userObjectId),
    );

    if (isFollowing) {
      await this.collectionModel.findByIdAndUpdate(collectionId, {
        $pull: { followers: userObjectId },
        $inc: { followersCount: -1 },
      });
      return { following: false, count: collection.followersCount - 1 };
    } else {
      await this.collectionModel.findByIdAndUpdate(collectionId, {
        $addToSet: { followers: userObjectId },
        $inc: { followersCount: 1 },
      });
      return { following: true, count: collection.followersCount + 1 };
    }
  }
}
