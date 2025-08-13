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
    if (createCollectionDto.pointId && !createCollectionDto.name) {
      console.log(
        'Adding to default collection with pointId:',
        createCollectionDto.pointId,
      );
      return this.addToDefaultCollection(createCollectionDto.pointId, userId);
    }

    const createdCollection = new this.collectionModel({
      ...createCollectionDto,
      userId: userId,
    });
    return createdCollection.save();
  }

  async addToDefaultCollection(
    pointId: string,
    userId: string,
  ): Promise<Collection> {
    if (!Types.ObjectId.isValid(pointId)) {
      console.log('pointId is invalid:', pointId);
      throw new BadRequestException('Invalid point ID');
    }

    // Chercher ou créer la collection par défaut "Mes favoris"
    let defaultCollection = await this.collectionModel.findOne({
      userId: userId,
      name: 'Mes favoris',
      isDefault: true,
    });

    if (!defaultCollection) {
      // Créer la collection par défaut si elle n'existe pas
      defaultCollection = new this.collectionModel({
        userId: userId,
        name: 'Mes favoris',
        description: 'Ma collection de points favoris',
        isPublic: false,
        isDefault: true,
        points: [new Types.ObjectId(pointId)],
        pointsCount: 1,
      });
      return defaultCollection.save();
    }

    // Ajouter le point à la collection existante
    const pointObjectId = new Types.ObjectId(pointId);
    if (!defaultCollection.points.some((p) => p.equals(pointObjectId))) {
      defaultCollection.points.push(pointObjectId);
      defaultCollection.pointsCount = defaultCollection.points.length;
      await defaultCollection.save();
    }

    return defaultCollection;
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
      query.userId = queryFilters.userId;
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

  async isPointInUserCollections(
    pointId: string,
    userId: string,
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(pointId)) {
      throw new BadRequestException('Invalid point ID');
    }

    const collection = await this.collectionModel.findOne({
      userId: userId,
      points: new Types.ObjectId(pointId),
      isActive: true,
    });

    return !!collection;
  }

  async removeFromDefaultCollection(
    pointId: string,
    userId: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(pointId)) {
      throw new BadRequestException('Invalid point ID');
    }

    // Chercher la collection par défaut
    const defaultCollection = await this.collectionModel.findOne({
      userId: userId,
      name: 'Mes favoris',
      isDefault: true,
    });

    if (!defaultCollection) {
      throw new NotFoundException('Default collection not found');
    }

    // Retirer le point
    defaultCollection.points = defaultCollection.points.filter(
      (p) => !p.equals(new Types.ObjectId(pointId)),
    );
    defaultCollection.pointsCount = defaultCollection.points.length;
    await defaultCollection.save();
  }

  async toggleFollow(
    collectionId: string,
    userId: string,
  ): Promise<{ following: boolean; count: number }> {
    const collection = await this.collectionModel.findById(collectionId);

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    const isFollowing = collection.followers.includes(userId);

    if (isFollowing) {
      await this.collectionModel.findByIdAndUpdate(collectionId, {
        $pull: { followers: userId },
        $inc: { followersCount: -1 },
      });
      return { following: false, count: collection.followersCount - 1 };
    } else {
      await this.collectionModel.findByIdAndUpdate(collectionId, {
        $addToSet: { followers: userId },
        $inc: { followersCount: 1 },
      });
      return { following: true, count: collection.followersCount + 1 };
    }
  }
}
