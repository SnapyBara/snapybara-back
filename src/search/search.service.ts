import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PointOfInterest,
  PointOfInterestDocument,
} from '../points/schemas/point-of-interest.schema';
import { Photo, PhotoDocument } from '../photos/schemas/photo.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Collection,
  CollectionDocument,
} from '../collections/schemas/collection.schema';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(PointOfInterest.name)
    private pointModel: Model<PointOfInterestDocument>,
    @InjectModel(Photo.name) private photoModel: Model<PhotoDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Collection.name)
    private collectionModel: Model<CollectionDocument>,
  ) {}

  async globalSearch(
    query: string,
    filters?: {
      types?: string[];
      limit?: number;
    },
  ): Promise<{
    points: any[];
    photos: any[];
    users: any[];
    collections: any[];
  }> {
    const searchRegex = new RegExp(query, 'i');
    const types = filters?.types || [
      'points',
      'photos',
      'users',
      'collections',
    ];
    const limit = filters?.limit || 5;

    const results = {
      points: [] as any[],
      photos: [] as any[],
      users: [] as any[],
      collections: [] as any[],
    };

    const searchPromises: Promise<any>[] = [];

    if (types.includes('points')) {
      searchPromises.push(
        this.pointModel
          .find({
            isActive: true,
            status: 'approved',
            $or: [
              { name: searchRegex },
              { description: searchRegex },
              { tags: searchRegex },
            ],
          })
          .limit(limit)
          .select('name category latitude longitude')
          .lean()
          .exec()
          .then((points) => {
            results.points = points;
          }),
      );
    }

    if (types.includes('photos')) {
      searchPromises.push(
        this.photoModel
          .find({
            isActive: true,
            status: 'approved',
            $or: [{ caption: searchRegex }, { tags: searchRegex }],
          })
          .limit(limit)
          .select('url thumbnailUrl caption')
          .populate('pointId', 'name')
          .lean()
          .exec()
          .then((photos) => {
            results.photos = photos;
          }),
      );
    }

    if (types.includes('users')) {
      searchPromises.push(
        this.userModel
          .find({
            isActive: true,
            $or: [{ username: searchRegex }, { email: searchRegex }],
          })
          .limit(limit)
          .select('username profilePicture level points')
          .lean()
          .exec()
          .then((users) => {
            results.users = users;
          }),
      );
    }

    if (types.includes('collections')) {
      searchPromises.push(
        this.collectionModel
          .find({
            isActive: true,
            isPublic: true,
            $or: [
              { name: searchRegex },
              { description: searchRegex },
              { tags: searchRegex },
            ],
          })
          .limit(limit)
          .select('name description pointsCount')
          .lean()
          .exec()
          .then((collections) => {
            results.collections = collections;
          }),
      );
    }

    await Promise.all(searchPromises);
    return results;
  }

  async searchPointsInArea(
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    },
    filters?: any,
  ): Promise<PointOfInterest[]> {
    const query: any = {
      isActive: true,
      status: 'approved',
      latitude: { $gte: bounds.south, $lte: bounds.north },
    };

    // Handle longitude wrap-around
    if (bounds.west > bounds.east) {
      query.$or = [
        { longitude: { $gte: bounds.west } },
        { longitude: { $lte: bounds.east } },
      ];
    } else {
      query.longitude = { $gte: bounds.west, $lte: bounds.east };
    }

    // Apply additional filters
    if (filters?.categories) {
      query.category = { $in: filters.categories };
    }

    if (filters?.minRating) {
      query['statistics.averageRating'] = { $gte: filters.minRating };
    }

    return this.pointModel
      .find(query)
      .limit(100)
      .select('name category latitude longitude statistics')
      .lean()
      .exec() as Promise<PointOfInterest[]>;
  }

  async searchSuggestions(query: string): Promise<{
    suggestions: string[];
    categories: string[];
    tags: string[];
  }> {
    if (!query || query.length < 2) {
      return { suggestions: [], categories: [], tags: [] };
    }

    const searchRegex = new RegExp(`^${query}`, 'i');

    const [pointNames, categories, tags] = await Promise.all([
      this.pointModel
        .find({
          isActive: true,
          status: 'approved',
          name: searchRegex,
        })
        .limit(5)
        .select('name')
        .lean()
        .exec()
        .then((points) => points.map((p: any) => p.name)),

      this.pointModel.distinct('category', {
        isActive: true,
        status: 'approved',
        category: searchRegex,
      }),

      this.pointModel.distinct('tags', {
        isActive: true,
        status: 'approved',
        tags: searchRegex,
      }),
    ]);

    return {
      suggestions: pointNames,
      categories: categories.slice(0, 5),
      tags: tags.slice(0, 5),
    };
  }
}
