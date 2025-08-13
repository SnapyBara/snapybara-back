import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PointOfInterest,
  PointOfInterestDocument,
} from './schemas/point-of-interest.schema';
import { CreatePointOfInterestDto, POICategory } from './dto/create-point.dto';
import { UpdatePointOfInterestDto } from './dto/update-point.dto';
import { SearchPointsDto } from './dto/search-points.dto';
import { CreatePointWithPhotosDto } from './dto/create-point-with-photos.dto';
import { GooglePlacesService } from '../google-places/google-places.service';
import { PhotosService } from '../photos/photos.service';
import { UploadService } from '../upload/upload.service';
import { Photo } from '../photos/schemas/photo.schema';
import { OverpassService } from '../overpass/overpass.service';
import { PhotoEnrichmentService } from '../overpass/photo-enrichment.service';
import { UsersService } from '../users/users.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    @InjectModel(PointOfInterest.name)
    private pointModel: Model<PointOfInterestDocument>,
    private googlePlacesService: GooglePlacesService,
    private photosService: PhotosService,
    private uploadService: UploadService,
    private overpassService: OverpassService,
    private photoEnrichmentService: PhotoEnrichmentService,
    private usersService: UsersService,
    private cacheService: CacheService,
  ) {}

  /**
   * Convert enum categories to lowercase strings for MongoDB
   */
  private categoriesToStrings(
    categories?: POICategory[],
  ): string[] | undefined {
    if (!categories) return undefined;
    return categories.map((cat) =>
      typeof cat === 'string' ? cat.toLowerCase() : cat,
    );
  }

  async create(
    createPointDto: CreatePointOfInterestDto,
    supabaseUserId: string,
  ): Promise<PointOfInterest> {
    const user = await this.usersService.findBySupabaseId(supabaseUserId);
    if (!user || !user._id) {
      throw new BadRequestException('User not found');
    }

    const createdPoint = new this.pointModel({
      ...createPointDto,
      location: {
        type: 'Point',
        coordinates: [createPointDto.longitude, createPointDto.latitude],
      },
      userId: user._id,
      status: 'pending',
      statistics: {
        averageRating: 0,
        totalReviews: 0,
        totalPhotos: 0,
        totalLikes: 0,
      },
    });
    const savedPoint = await createdPoint.save();
    await this.invalidateAreaCache(
      createPointDto.latitude,
      createPointDto.longitude,
      10,
    );
    return savedPoint;
  }

  /**
   * Create a point of interest with photos
   */
  async createWithPhotos(
    createPointWithPhotosDto: CreatePointWithPhotosDto,
    supabaseUserId: string,
  ): Promise<{
    point: PointOfInterest;
    photos: Photo[];
  }> {
    const user = await this.usersService.findBySupabaseId(supabaseUserId);
    if (!user || !user._id) {
      throw new BadRequestException('User not found');
    }

    const session = await this.pointModel.db.startSession();
    session.startTransaction();

    try {
      const pointData = {
        name: createPointWithPhotosDto.name,
        description: createPointWithPhotosDto.description,
        latitude: createPointWithPhotosDto.latitude,
        longitude: createPointWithPhotosDto.longitude,
        location: {
          type: 'Point',
          coordinates: [
            createPointWithPhotosDto.longitude,
            createPointWithPhotosDto.latitude,
          ],
        },
        category: createPointWithPhotosDto.category,
        userId: user._id,
        status: 'pending',
        isPublic: createPointWithPhotosDto.isPublic ?? true,
        tags: createPointWithPhotosDto.tags || [],
        address: createPointWithPhotosDto.address,
        bestTimeToVisit: createPointWithPhotosDto.bestTimeToVisit,
        photographyTips: createPointWithPhotosDto.photographyTips,
        accessibilityInfo: createPointWithPhotosDto.accessibilityInfo,
        difficulty: createPointWithPhotosDto.difficulty,
        isFreeAccess: createPointWithPhotosDto.isFreeAccess,
        requiresPermission: createPointWithPhotosDto.requiresPermission,
        metadata: {
          ...createPointWithPhotosDto.metadata,
          googlePlaceId: createPointWithPhotosDto.googlePlaceId,
        },
        statistics: {
          averageRating: 0,
          totalReviews: 0,
          totalPhotos: createPointWithPhotosDto.photos.length,
          totalLikes: 0,
        },
      };

      const createdPoint = new this.pointModel(pointData);
      await createdPoint.save({ session });

      const uploadedPhotos: Photo[] = [];

      for (const photoDto of createPointWithPhotosDto.photos) {
        try {
          let photoData;

          if (photoDto.imageData.startsWith('data:image')) {
            const matches = photoDto.imageData.match(
              /^data:image\/(\w+);base64,(.+)$/,
            );
            if (!matches) {
              throw new BadRequestException('Invalid base64 image format');
            }

            const imageBuffer = Buffer.from(matches[2], 'base64');
            const mimeType = `image/${matches[1]}`;

            const file = {
              buffer: imageBuffer,
              mimetype: mimeType,
              originalname: `photo-${Date.now()}.${matches[1]}`,
              size: imageBuffer.length,
              fieldname: 'photo',
              encoding: '7bit',
            } as Express.Multer.File;

            photoData = await this.uploadService.uploadImage(file);
          } else if (photoDto.imageData.startsWith('http')) {
            const response = await fetch(photoDto.imageData);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const contentType =
              response.headers.get('content-type') || 'image/jpeg';

            const file = {
              buffer,
              mimetype: contentType,
              originalname: `photo-${Date.now()}.jpg`,
              size: buffer.length,
              fieldname: 'photo',
              encoding: '7bit',
            } as Express.Multer.File;

            photoData = await this.uploadService.uploadImage(file);
          } else {
            throw new BadRequestException('Invalid image data format');
          }

          let exifData = {};
          if (photoDto.metadata) {
            exifData = {
              camera: photoDto.metadata.camera,
              lens: photoDto.metadata.lens,
              focalLength: photoDto.metadata.focalLength,
              aperture: photoDto.metadata.aperture,
              shutterSpeed: photoDto.metadata.shutterSpeed,
              iso: photoDto.metadata.iso,
              capturedAt: photoDto.metadata.capturedAt,
              weather: photoDto.metadata.weather,
              timeOfDay: photoDto.metadata.timeOfDay,
            };
          }

          const photo = await this.photosService.create(
            {
              pointId: createdPoint._id.toString(),
              url: photoData.url,
              thumbnailUrl: photoData.thumbnailUrl,
              mediumUrl: photoData.mediumUrl,
              caption: photoDto.caption,
              metadata: {
                ...photoData.metadata,
                ...exifData,
              },
              tags: photoDto.tags || [],
              isPublic: createPointWithPhotosDto.isPublic ?? true,
            },
            supabaseUserId,
            session,
          );

          uploadedPhotos.push(photo);
        } catch (error) {
          this.logger.error('Error uploading photo:', error);
        }
      }

      if (uploadedPhotos.length > 0) {
        await this.pointModel.updateOne(
          { _id: createdPoint._id },
          {
            $set: {
              'statistics.totalPhotos': uploadedPhotos.length,
            },
          },
          { session },
        );
      }

      await session.commitTransaction();

      const populatedPoint = await this.pointModel
        .findById(createdPoint._id)
        .populate('userId', 'username profilePicture')
        .exec();

      return {
        point: populatedPoint!,
        photos: uploadedPhotos,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async findAll(searchDto: SearchPointsDto): Promise<{
    data: PointOfInterest[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...filters } = searchDto;
    const skip = (page - 1) * limit;

    const categoriesAsStrings = this.categoriesToStrings(filters.categories);

    if (filters.latitude && filters.longitude && filters.radius) {
      const pipeline: any[] = [
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [filters.longitude, filters.latitude],
            },
            distanceField: 'distance',
            maxDistance: filters.radius * 1000, // Convert km to meters
            spherical: true,
            query: { isActive: true, status: 'approved' },
          },
        },
      ];

      const matchConditions: any = {};

      if (categoriesAsStrings && categoriesAsStrings.length > 0) {
        matchConditions.category = { $in: categoriesAsStrings };
      }

      if (filters.minRating) {
        matchConditions['statistics.averageRating'] = {
          $gte: filters.minRating,
        };
      }

      if (filters.hasPhotos) {
        matchConditions['statistics.totalPhotos'] = { $gt: 0 };
      }

      if (filters.tags && filters.tags.length > 0) {
        matchConditions.tags = { $in: filters.tags };
      }

      if (filters.search) {
        matchConditions.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { tags: { $regex: filters.search, $options: 'i' } },
        ];
      }

      if (Object.keys(matchConditions).length > 0) {
        pipeline.push({ $match: matchConditions });
      }

      let sortField: any = {};
      switch (filters.sortBy) {
        case 'rating':
          sortField = { 'statistics.averageRating': -1 };
          break;
        case 'recent':
          sortField = { createdAt: -1 };
          break;
        case 'popular':
          sortField = { viewCount: -1 };
          break;
        default:
          sortField = { distance: 1 };
      }

      if (Object.keys(sortField).length > 0 && filters.sortBy !== 'distance') {
        pipeline.push({ $sort: sortField });
      }
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      pipeline.push({
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userId',
        },
      });
      pipeline.push({
        $unwind: {
          path: '$userId',
          preserveNullAndEmptyArrays: true,
        },
      });
      pipeline.push({
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          latitude: 1,
          longitude: 1,
          location: 1,
          category: 1,
          address: 1,
          photos: 1,
          tags: 1,
          statistics: 1,
          metadata: 1,
          userId: {
            _id: '$userId._id',
            username: '$userId.username',
            profilePicture: '$userId.profilePicture',
          },
          status: 1,
          isActive: 1,
          isPublic: 1,
          viewCount: 1,
          createdAt: 1,
          updatedAt: 1,
          distance: 1,
        },
      });

      const data = await this.pointModel.aggregate(pipeline);

      // Pour le total, on doit faire une requête séparée
      const totalPipeline: any[] = [
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [filters.longitude, filters.latitude],
            },
            distanceField: 'distance',
            maxDistance: filters.radius * 1000,
            spherical: true,
            query: { isActive: true, status: 'approved' },
          },
        },
      ];

      if (Object.keys(matchConditions).length > 0) {
        totalPipeline.push({ $match: matchConditions });
      }

      totalPipeline.push({ $count: 'total' });

      const totalResult = await this.pointModel.aggregate(totalPipeline);
      const total = totalResult.length > 0 ? totalResult[0].total : 0;

      return { data, total, page, limit };
    }

    // Si pas de recherche géographique, utiliser la requête normale
    const query: any = { isActive: true, status: 'approved' };

    // Category filter
    if (categoriesAsStrings && categoriesAsStrings.length > 0) {
      query.category = { $in: categoriesAsStrings };
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
        sort = { createdAt: -1 };
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

    // Générer la clé de cache pour ce POI
    const cacheKey = `${this.cacheService['PREFIXES'].POINTS_DETAILS}${id}`;

    // Vérifier le cache
    const cachedPoint = await this.cacheService.get<PointOfInterest>(cacheKey);
    if (cachedPoint) {
      this.logger.debug(`Cache HIT for point details: ${id}`);

      // Incrémenter le compteur de vues de manière asynchrone
      this.pointModel.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }).exec();

      return cachedPoint;
    }

    const point = await this.pointModel
      .findById(id)
      .populate('userId', 'username profilePicture')
      .exec();

    if (!point) {
      throw new NotFoundException('Point not found');
    }

    // Incrémenter le compteur de vues
    await this.pointModel.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

    // Sauvegarder en cache
    await this.cacheService.set(cacheKey, point, {
      ttl: this.cacheService['DEFAULT_TTL'].DETAILS,
    });

    this.logger.debug(`Cache SET for point details: ${id}`);

    return point;
  }

  async findByUser(supabaseUserId: string): Promise<PointOfInterest[]> {
    // Trouver l'utilisateur MongoDB à partir du supabaseId
    const user = await this.usersService.findBySupabaseId(supabaseUserId);
    if (!user || !user._id) {
      return [];
    }

    return this.pointModel
      .find({ userId: user._id, isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(
    id: string,
    updatePointDto: UpdatePointOfInterestDto,
    supabaseUserId: string,
  ): Promise<PointOfInterest> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid point ID');
    }

    // Trouver l'utilisateur MongoDB à partir du supabaseId
    const user = await this.usersService.findBySupabaseId(supabaseUserId);
    if (!user || !user._id) {
      throw new BadRequestException('User not found');
    }

    if (!user || !user._id) {
      throw new BadRequestException('User not found');
    }

    if (!user || !user._id) {
      throw new BadRequestException('User not found');
    }

    const point = await this.pointModel.findById(id);
    if (!point) {
      throw new NotFoundException('Point not found');
    }

    if (point.userId.toString() !== user._id.toString()) {
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

    // Invalider le cache pour ce POI spécifique
    const detailsCacheKey = `${this.cacheService['PREFIXES'].POINTS_DETAILS}${id}`;
    await this.cacheService.del(detailsCacheKey);

    // Invalider le cache de recherche pour cette zone
    await this.invalidateAreaCache(updated.latitude, updated.longitude, 10);

    return updated;
  }

  async remove(id: string, supabaseUserId: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid point ID');
    }

    // Trouver l'utilisateur MongoDB à partir du supabaseId
    const user = await this.usersService.findBySupabaseId(supabaseUserId);
    if (!user || !user._id) {
      throw new BadRequestException('User not found');
    }

    if (!user || !user._id) {
      throw new BadRequestException('User not found');
    }

    if (!user || !user._id) {
      throw new BadRequestException('User not found');
    }

    const point = await this.pointModel.findById(id);
    if (!point) {
      throw new NotFoundException('Point not found');
    }

    if (point.userId.toString() !== user._id.toString()) {
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

  /**
   * Mettre à jour les statistiques d'un point après l'ajout d'une review
   */
  async updatePointStatistics(
    pointId: string,
    stats: { averageRating: number; totalReviews: number },
  ): Promise<void> {
    if (!Types.ObjectId.isValid(pointId)) {
      throw new BadRequestException('Invalid point ID');
    }

    await this.pointModel.findByIdAndUpdate(
      pointId,
      {
        $set: {
          'statistics.averageRating': stats.averageRating,
          'statistics.totalReviews': stats.totalReviews,
        },
      },
      { new: true },
    );

    this.logger.debug(
      `Updated statistics for point ${pointId}: rating=${stats.averageRating}, reviews=${stats.totalReviews}`,
    );
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

  /**
   * Hybrid search with mongo and another API (Overpass)
   * Include google place api when user is prenium
   */
  async searchHybrid(
    searchDto: SearchPointsDto & { includeGooglePlaces?: boolean },
  ): Promise<{
    data: PointOfInterest[];
    total: number;
    page: number;
    limit: number;
    sources: { mongodb: number; openstreetmap: number; googlePlaces?: number };
  }> {
    const { page = 1, limit = 20 } = searchDto;

    // Générer une clé de cache unique pour cette recherche
    const cacheKey = this.generateSearchCacheKey(searchDto);

    // Vérifier le cache
    const cachedResult = await this.cacheService.get<{
      data: PointOfInterest[];
      total: number;
      page: number;
      limit: number;
      sources: {
        mongodb: number;
        openstreetmap: number;
        googlePlaces?: number;
      };
    }>(cacheKey);

    if (cachedResult) {
      this.logger.debug(`Cache HIT for searchHybrid: ${cacheKey}`);
      return cachedResult;
    }

    const effectiveLimit = Math.min(limit, 200);

    const mongoResults = await this.findAll({
      ...searchDto,
      limit: effectiveLimit,
    });

    const finalResults = [...mongoResults.data];
    let osmCount = 0;
    let googleCount = 0;

    const existingPositions = new Map<string, PointOfInterest>();
    const existingOsmIds = new Set<string>();
    const existingGooglePlaceIds = new Set<string>();

    mongoResults.data.forEach((point) => {
      const posKey = `${point.latitude.toFixed(6)}_${point.longitude.toFixed(6)}`;
      existingPositions.set(posKey, point);

      if (point.metadata?.osmId) {
        existingOsmIds.add(point.metadata.osmId);
      }

      if (point.metadata?.googlePlaceId) {
        existingGooglePlaceIds.add(point.metadata.googlePlaceId);
      }
    });

    const remainingSlots = effectiveLimit - mongoResults.data.length;

    if (remainingSlots > 0 && searchDto.latitude && searchDto.longitude) {
      if (searchDto.includeGooglePlaces === true && remainingSlots > 0) {
        this.logger.debug(
          `MongoDB returned ${mongoResults.data.length} results, fetching ${remainingSlots} more from Google Places (includeGooglePlaces=${searchDto.includeGooglePlaces})`,
        );

        try {
          const googleResults = await this.searchGooglePlaces(
            searchDto,
            remainingSlots,
          );

          for (const googlePlace of googleResults) {
            if (finalResults.length >= effectiveLimit) break;

            if (existingGooglePlaceIds.has(googlePlace.place_id)) {
              this.logger.debug(
                `Skipping Google Place ${googlePlace.place_id} - already exists in MongoDB`,
              );
              continue;
            }

            const posKey = `${googlePlace.geometry.location.lat.toFixed(6)}_${googlePlace.geometry.location.lng.toFixed(6)}`;
            let isDuplicate = false;

            for (const [existingKey, existingPoint] of existingPositions) {
              const distance = this.calculateDistance(
                googlePlace.geometry.location.lat,
                googlePlace.geometry.location.lng,
                existingPoint.latitude,
                existingPoint.longitude,
              );

              if (distance < 100) {
                this.logger.debug(
                  `Skipping Google Place "${googlePlace.name}" - too close to existing "${existingPoint.name}" (${distance}m)`,
                );
                isDuplicate = true;
                break;
              }
            }

            if (isDuplicate) continue;

            const convertedPlace =
              this.googlePlacesService.convertToPointOfInterest(googlePlace);

            const poiData = {
              ...convertedPlace,
              _id: new Types.ObjectId(),
              id: new Types.ObjectId().toString(),
              location: {
                type: 'Point',
                coordinates: [
                  convertedPlace.longitude,
                  convertedPlace.latitude,
                ],
              },
              userId: null,
              isPublic: true,
              isActive: true,
              status: 'approved',
              viewCount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              metadata: {
                ...convertedPlace.metadata,
                source: 'googleplaces',
              },
            } as any;

            finalResults.push(poiData);
            existingPositions.set(posKey, poiData);
            existingGooglePlaceIds.add(googlePlace.place_id);
            googleCount++;
          }
        } catch (error) {
          this.logger.error('Error fetching Google Places results:', error);
        }
      }

      const remainingSlotsAfterGoogle = effectiveLimit - finalResults.length;

      if (
        remainingSlotsAfterGoogle > 0 &&
        searchDto.includeOpenStreetMap !== false
      ) {
        try {
          const osmResults = await this.overpassService.searchPOIs(
            searchDto.latitude,
            searchDto.longitude,
            searchDto.radius || 3, // Km
            searchDto.categories?.map((cat) => cat.toLowerCase()),
          );

          //Filter search
          for (const osmPOI of osmResults.data || []) {
            if (finalResults.length >= effectiveLimit) break;

            if (existingOsmIds.has(osmPOI.id)) {
              this.logger.debug(
                `Skipping OSM POI ${osmPOI.id} - already exists in MongoDB`,
              );
              continue;
            }

            const posKey = `${osmPOI.lat.toFixed(6)}_${osmPOI.lon.toFixed(6)}`;
            let isDuplicate = false;

            for (const [existingKey, existingPoint] of existingPositions) {
              const distance = this.calculateDistance(
                osmPOI.lat,
                osmPOI.lon,
                existingPoint.latitude,
                existingPoint.longitude,
              );

              if (distance < 100) {
                this.logger.debug(
                  `Skipping OSM POI "${osmPOI.name}" - too close to existing "${existingPoint.name}" (${distance}m)`,
                );
                isDuplicate = true;
                break;
              }
            }

            if (isDuplicate) continue;

            const category = this.mapOSMTypeToCategory(osmPOI.type);

            if (searchDto.categories && searchDto.categories.length > 0) {
              const categoriesAsStrings = this.categoriesToStrings(
                searchDto.categories,
              );
              if (!categoriesAsStrings?.includes(category)) {
                continue;
              }
            }

            const poiData = {
              _id: new Types.ObjectId(),
              id: new Types.ObjectId().toString(),
              name: osmPOI.name,
              description: this.generateDescription(osmPOI),
              latitude: osmPOI.lat,
              longitude: osmPOI.lon,
              location: {
                type: 'Point',
                coordinates: [osmPOI.lon, osmPOI.lat],
              },
              category,
              address: {
                formattedAddress:
                  osmPOI.tags['addr:full'] ||
                  `${osmPOI.tags['addr:street'] || ''} ${osmPOI.tags['addr:housenumber'] || ''}`.trim() ||
                  osmPOI.tags['addr:city'] ||
                  null,
                street: osmPOI.tags['addr:street'] || null,
                city: osmPOI.tags['addr:city'] || null,
                postalCode: osmPOI.tags['addr:postcode'] || null,
                country: osmPOI.tags['addr:country'] || null,
              },
              photos: [],
              tags: this.extractTags(osmPOI),
              statistics: {
                averageRating: 0,
                totalReviews: 0,
                totalPhotos: 0,
                totalLikes: 0,
              },
              metadata: {
                source: 'openstreetmap',
                osmId: osmPOI.id,
                osmType: osmPOI.type,
                osmTags: osmPOI.tags,
                lastSync: new Date(),
                imageUrl: osmPOI.tags['image_url'],
                wikipedia: osmPOI.tags['wikipedia'],
                wikidata: osmPOI.tags['wikidata'],
                website: osmPOI.tags['website'],
                openingHours: osmPOI.tags['opening_hours'],
              },
              userId: null,
              isPublic: true,
              isActive: true,
              status: 'approved',
              viewCount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any;

            finalResults.push(poiData);
            existingPositions.set(posKey, poiData);
            osmCount++;
          }
        } catch (error) {
          this.logger.error('Error fetching OSM results:', error);
        }
      }
    }

    const result = {
      data: finalResults.slice(0, effectiveLimit),
      total: mongoResults.total + osmCount + googleCount,
      page,
      limit: effectiveLimit,
      sources: {
        mongodb: mongoResults.data.length,
        openstreetmap: osmCount,
        ...(googleCount > 0 && { googlePlaces: googleCount }),
      },
    };

    // Sauvegarder en cache
    await this.cacheService.set(cacheKey, result, {
      ttl: this.cacheService.DEFAULT_TTL.SEARCH,
    });

    this.logger.debug(`Cache SET for searchHybrid: ${cacheKey}`);

    return result;
  }

  /**
   * Check distance between two coords
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Map all possible types of OSM (Check overpass docs)
   */
  private mapOSMTypeToCategory(osmType: string): string {
    const mapping: Record<string, string> = {
      viewpoint: 'landscape',
      museum: 'historical',
      monument: 'historical',
      memorial: 'historical',
      castle: 'historical',
      ruins: 'historical',
      cathedral: 'architecture',
      church: 'architecture',
      chapel: 'architecture',
      religious: 'architecture',
      artwork: 'street_art',
      statue: 'street_art',
      fountain: 'architecture',
      bridge: 'architecture',
      tower: 'architecture',
      waterfall: 'landscape',
      cliff: 'landscape',
      peak: 'mountain',
      lake: 'landscape',
      beach: 'landscape',
      garden: 'forest',
      park: 'forest',
      square: 'architecture',
      attraction: 'landscape',
    };

    return mapping[osmType] || 'other';
  }

  /**
   * generate description from OSM
   */
  private generateDescription(osmPOI: any): string {
    const parts: string[] = [];

    if (osmPOI.tags['description']) {
      parts.push(osmPOI.tags['description']);
    }

    if (osmPOI.tags['tourism']) {
      parts.push(`Type: ${osmPOI.tags['tourism']}`);
    }

    if (osmPOI.tags['historic']) {
      parts.push(`Historic: ${osmPOI.tags['historic']}`);
    }

    if (osmPOI.tags['heritage']) {
      parts.push('Site classé au patrimoine');
    }

    return parts.join('. ') || `${osmPOI.type} - ${osmPOI.name}`;
  }

  /**
   * extracts tags from osm
   */
  private extractTags(osmPOI: any): string[] {
    const tags: string[] = [];

    if (osmPOI.type) tags.push(osmPOI.type);
    if (osmPOI.tags['tourism']) tags.push(osmPOI.tags['tourism']);
    if (osmPOI.tags['historic']) tags.push(osmPOI.tags['historic']);
    if (osmPOI.tags['amenity']) tags.push(osmPOI.tags['amenity']);
    if (osmPOI.tags['heritage']) tags.push('patrimoine');
    if (osmPOI.tags['wikipedia']) tags.push('wikipedia');

    return [...new Set(tags)];
  }

  /**
   * Seach in google place
   */
  private async searchGooglePlaces(
    searchDto: SearchPointsDto,
    limit: number,
  ): Promise<any[]> {
    const { latitude, longitude, search, radius = 10 } = searchDto;

    if (!latitude || !longitude) {
      return [];
    }

    const safeRadius = Math.min(radius, 50);
    const radiusInMeters = safeRadius * 1000;

    let results: any[] = [];

    const categoriesAsStrings = this.categoriesToStrings(searchDto.categories);

    if (categoriesAsStrings?.includes('mountain')) {
      const mountainKeywords = ['pic', 'mont', 'sommet', 'col', 'crête'];
      for (const keyword of mountainKeywords) {
        const keywordResults = await this.googlePlacesService.textSearch({
          query: keyword,
          latitude,
          longitude,
          radius: radiusInMeters,
        });
        results = results.concat(keywordResults);
      }
    }

    if (search) {
      const textResults = await this.googlePlacesService.textSearch({
        query: search,
        latitude,
        longitude,
        radius: radiusInMeters,
      });
      results = results.concat(textResults);
    }

    if (results.length < limit) {
      const nearbyResults = await this.googlePlacesService.nearbySearch({
        latitude,
        longitude,
        radius: radiusInMeters,
        keyword: search,
      });

      const existingPlaceIds = new Set(results.map((r) => r.place_id));
      const uniqueNearbyResults = nearbyResults.filter(
        (r) => !existingPlaceIds.has(r.place_id),
      );

      results = results.concat(uniqueNearbyResults);
    }

    if (results.length < limit / 2) {
      const natureKeywords = [
        'viewpoint',
        'belvédère',
        'panorama',
        'site naturel',
      ];
      for (const keyword of natureKeywords) {
        if (results.length >= limit) break;

        const natureResults = await this.googlePlacesService.textSearch({
          query: keyword,
          latitude,
          longitude,
          radius: radiusInMeters,
        });

        const existingPlaceIds = new Set(results.map((r) => r.place_id));
        const uniqueResults = natureResults.filter(
          (r) => !existingPlaceIds.has(r.place_id),
        );
        results = results.concat(uniqueResults);
      }
    }

    const uniqueResults = Array.from(
      new Map(results.map((item) => [item.place_id, item])).values(),
    );

    return uniqueResults.slice(0, limit);
  }

  /**
   * Filter place on osm
   */
  private async filterExistingPlaces(osmResults: any): Promise<any[]> {
    if (!osmResults?.data || osmResults.data.length === 0) return [];

    const osmPOIs = osmResults.data;

    const osmIds = osmPOIs.map((poi) => poi.id);

    const existingPlaces = await this.pointModel
      .find({
        'metadata.osmId': { $in: osmIds },
      })
      .select('metadata.osmId')
      .exec();

    const existingOsmIds = new Set(
      existingPlaces.map((place) => place.metadata?.osmId),
    );
    const filtered: any[] = [];

    for (const poi of osmPOIs) {
      if (existingOsmIds.has(poi.id)) {
        continue;
      }
      const nearbyExisting = await this.pointModel.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [poi.lon, poi.lat],
            },
            distanceField: 'distance',
            maxDistance: 100, // 100 mètres
            spherical: true,
            query: { isActive: true },
          },
        },
        { $limit: 1 },
      ]);

      if (nearbyExisting.length === 0) {
        filtered.push(poi);
      }
    }

    return filtered;
  }

  /**
   * Obtains details from place with google place api
   */
  async getPlaceFromGooglePlaces(
    placeId: string,
    saveToMongoDB: boolean = false,
  ): Promise<any> {
    const googlePlace = await this.googlePlacesService.getPlaceDetails(placeId);

    if (!googlePlace) {
      throw new NotFoundException('Place not found in Google Places');
    }

    const convertedPlace =
      this.googlePlacesService.convertToPointOfInterest(googlePlace);

    if (saveToMongoDB) {
      // Créer un point dans MongoDB avec un utilisateur système ou sans utilisateur
      const savedPoint = new this.pointModel({
        ...convertedPlace,
        location: {
          type: 'Point',
          coordinates: [convertedPlace.longitude, convertedPlace.latitude],
        },
        userId: null, // Ou créer un utilisateur système
        status: 'approved',
        isPublic: true,
        metadata: {
          ...convertedPlace.metadata,
          importedFromGooglePlaces: true,
          importedAt: new Date(),
        },
      });

      return await savedPoint.save();
    }

    return {
      ...convertedPlace,
      id: new Types.ObjectId().toString(), // ID temporaire
      location: {
        type: 'Point',
        coordinates: [convertedPlace.longitude, convertedPlace.latitude],
      },
      userId: null,
      isPublic: true,
      isActive: true,
      status: 'approved',
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Importer des lieux depuis Google Places dans une zone géographique
   */
  async importFromGooglePlaces(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
    maxPlaces: number = 50,
  ): Promise<{ imported: number; skipped: number; errors: number }> {
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // S'assurer que le rayon ne dépasse pas 50km (limite Google Places)
      const safeRadius = Math.min(radiusKm, 50);

      const googlePlaces = await this.googlePlacesService.nearbySearch({
        latitude,
        longitude,
        radius: safeRadius * 1000, // Convertir km en mètres
      });

      const filteredPlaces = await this.filterExistingPlaces(googlePlaces);
      const placesToImport = filteredPlaces.slice(0, maxPlaces);

      for (const googlePlace of placesToImport) {
        try {
          const convertedPlace =
            this.googlePlacesService.convertToPointOfInterest(googlePlace);

          const newPoint = new this.pointModel({
            ...convertedPlace,
            location: {
              type: 'Point',
              coordinates: [convertedPlace.longitude, convertedPlace.latitude],
            },
            userId: null, // Ou créer un utilisateur système
            status: 'approved',
            isPublic: true,
            metadata: {
              ...convertedPlace.metadata,
              importedFromGooglePlaces: true,
              importedAt: new Date(),
            },
          });

          await newPoint.save();
          imported++;
        } catch (error) {
          this.logger.error(
            `Error importing place ${googlePlace.place_id}:`,
            error,
          );
          errors++;
        }
      }

      skipped = filteredPlaces.length - placesToImport.length;

      this.logger.log(
        `Import completed: ${imported} imported, ${skipped} skipped, ${errors} errors`,
      );
    } catch (error) {
      this.logger.error('Error during Google Places import:', error);
      errors++;
    }

    return { imported, skipped, errors };
  }

  /**
   * Enrichir des POIs avec des photos - endpoint pour progressive loading
   */
  async enrichPOIsWithPhotos(pois: any[]): Promise<Record<string, any[]>> {
    const result: Record<string, any[]> = {};

    // Limiter à 5 POI à la fois pour éviter les timeouts
    const poisToProcess = pois.slice(0, 5);

    // Vérifier le cache pour chaque POI
    const uncachedPois: any[] = [];
    for (const poi of poisToProcess) {
      const cacheKey = `${this.cacheService['PREFIXES'].GOOGLE_PLACES_PHOTOS}poi:${poi.id}`;
      const cachedPhotos = await this.cacheService.get<any[]>(cacheKey);

      if (cachedPhotos) {
        this.logger.debug(`Cache HIT for POI photos: ${poi.id}`);
        result[poi.id] = cachedPhotos;
      } else {
        uncachedPois.push(poi);
      }
    }

    if (uncachedPois.length === 0) {
      return result;
    }

    try {
      // Enrichir les POI non cachés avec le service
      const enrichedPOIs =
        await this.photoEnrichmentService.enrichPOIsWithPhotos(uncachedPois);

      // Extraire les photos pour chaque POI et les mettre en cache
      for (const poi of enrichedPOIs) {
        if (poi.photos && poi.photos.length > 0) {
          const photos = poi.photos.map((photo) => ({
            reference: photo.url,
            url: photo.url,
            width: photo.width || 800,
            height: photo.height || 600,
            attribution: photo.attribution,
          }));

          result[poi.id] = photos;

          // Mettre en cache les photos pour ce POI
          const cacheKey = `${this.cacheService['PREFIXES'].GOOGLE_PLACES_PHOTOS}poi:${poi.id}`;
          await this.cacheService.set(cacheKey, photos, {
            ttl: this.cacheService['DEFAULT_TTL'].PHOTOS, // Cache plus long pour les photos (7 jours)
          });
        }
      }

      this.logger.debug(
        `Enriched ${Object.keys(result).length} POIs with photos`,
      );
    } catch (error) {
      this.logger.error('Failed to enrich POIs with photos', error);
    }

    return result;
  }

  /**
   * Get all pending points for moderation
   */
  async getPendingPoints(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: PointOfInterest[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.pointModel
        .find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'username profilePicture email')
        .exec(),
      this.pointModel.countDocuments({ status: 'pending' }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Get all points with admin filtering options
   */
  async getAllPointsAdmin(filters: {
    page: number;
    limit: number;
    status?: string;
    category?: string;
    search?: string;
  }): Promise<{
    data: PointOfInterest[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, status, category, search } = filters;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.pointModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'username profilePicture email')
        .exec(),
      this.pointModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Update point status (approve/reject)
   */
  async updatePointStatus(
    id: string,
    status: 'approved' | 'rejected',
    adminUserId: string,
    reason?: string,
  ): Promise<PointOfInterest> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid point ID');
    }

    const point = await this.pointModel.findById(id);
    if (!point) {
      throw new NotFoundException('Point not found');
    }

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'rejected' && reason) {
      updateData['metadata.rejectionReason'] = reason;
      updateData['metadata.rejectedBy'] = adminUserId;
      updateData['metadata.rejectedAt'] = new Date();
    } else if (status === 'approved') {
      updateData['metadata.approvedBy'] = adminUserId;
      updateData['metadata.approvedAt'] = new Date();
    }

    const updated = await this.pointModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('userId', 'username profilePicture')
      .exec();

    if (!updated) {
      throw new NotFoundException('Point not found');
    }

    // TODO: Send notification to user about status change

    return updated;
  }

  /**
   * Delete a point permanently (admin only)
   */
  async adminDeletePoint(id: string, adminUserId: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid point ID');
    }

    const point = await this.pointModel.findById(id);
    if (!point) {
      throw new NotFoundException('Point not found');
    }

    // TODO: Delete associated photos and reviews

    await this.pointModel.findByIdAndDelete(id);

    this.logger.log(`Point ${id} permanently deleted by admin ${adminUserId}`);
  }

  /**
   * Get moderation statistics for dashboard
   */
  async getModerationStats(): Promise<{
    pendingCount: number;
    approvedToday: number;
    rejectedToday: number;
    totalPOIs: number;
    activeUsers: number;
    recentSubmissions: any[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get counts
    const [
      pendingCount,
      approvedToday,
      rejectedToday,
      totalPOIs,
      recentSubmissions,
    ] = await Promise.all([
      // Points en attente
      this.pointModel.countDocuments({ status: 'pending' }),

      // Points approuvés aujourd'hui
      this.pointModel.countDocuments({
        status: 'approved',
        'metadata.approvedAt': {
          $gte: today,
          $lt: tomorrow,
        },
      }),

      // Points rejetés aujourd'hui
      this.pointModel.countDocuments({
        status: 'rejected',
        'metadata.rejectedAt': {
          $gte: today,
          $lt: tomorrow,
        },
      }),

      // Total des points actifs
      this.pointModel.countDocuments({ isActive: true }),

      // 5 dernières soumissions
      this.pointModel
        .find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'username email')
        .select('name createdAt userId')
        .exec(),
    ]);

    // Count active users (ceux qui ont soumis des points dans les 30 derniers jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = await this.pointModel.distinct('userId', {
      createdAt: { $gte: thirtyDaysAgo },
    });

    return {
      pendingCount,
      approvedToday,
      rejectedToday,
      totalPOIs,
      activeUsers: activeUsers.length,
      recentSubmissions: recentSubmissions.map((submission) => ({
        id: submission._id,
        name: submission.name,
        submittedBy: submission.userId
          ? {
              username: (submission.userId as any).username,
              email: (submission.userId as any).email,
            }
          : null,
        createdAt: submission.createdAt,
      })),
    };
  }

  /**
   * Generate a unique cache key for search queries
   */
  private generateSearchCacheKey(
    searchDto: SearchPointsDto & { includeGooglePlaces?: boolean },
  ): string {
    const {
      latitude,
      longitude,
      radius,
      categories,
      search,
      page,
      limit,
      minRating,
      hasPhotos,
      tags,
      sortBy,
      includeGooglePlaces,
      includeOpenStreetMap,
    } = searchDto;

    // Round coordinates to reduce cache key variations
    const lat = latitude ? Math.round(latitude * 1000) / 1000 : 0;
    const lng = longitude ? Math.round(longitude * 1000) / 1000 : 0;

    let key = `${this.cacheService['PREFIXES'].POINTS_SEARCH}hybrid:${lat},${lng}`;

    if (radius) key += `:r${radius}`;
    if (categories?.length) {
      const sortedCategories = [...categories].sort();
      key += `:c${sortedCategories.join(',')}`;
    }
    if (search) key += `:s${search.toLowerCase().replace(/\s+/g, '_')}`;
    if (minRating) key += `:mr${minRating}`;
    if (hasPhotos !== undefined) key += `:hp${hasPhotos}`;
    if (tags?.length) {
      const sortedTags = [...tags].sort();
      key += `:t${sortedTags.join(',')}`;
    }
    if (sortBy) key += `:sb${sortBy}`;
    if (includeGooglePlaces) key += ':gp';
    if (includeOpenStreetMap === false) key += ':no-osm';

    // Add pagination
    key += `:p${page || 1}-${limit || 20}`;

    return key;
  }

  /**
   * Invalidate cache for a specific area when new POI is added
   */
  private async invalidateAreaCache(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
  ): Promise<void> {
    // For now, we'll just log this action
    // In a production environment with Redis, we would implement pattern-based deletion
    this.logger.debug(
      `Cache invalidation requested for area: ${latitude},${longitude} with radius ${radiusKm}km`,
    );

    // TODO: Implement cache invalidation strategy when using Redis
    // For example: await this.cacheService.invalidateAreaCache(latitude, longitude, radiusKm);
  }

  /**
   * Get all photos for a specific point
   */
  async getPointPhotos(pointId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(pointId)) {
      throw new BadRequestException('Invalid point ID');
    }

    // Vérifier que le point existe
    const point = await this.pointModel.findById(pointId);
    if (!point) {
      throw new NotFoundException('Point not found');
    }

    // Récupérer toutes les photos associées à ce point
    const photos = await this.photosService.findByPoint(pointId);

    return photos;
  }

  /**
   * Upload a photo for a specific point
   */
  async uploadPhotoForPoint(
    pointId: string,
    file: Express.Multer.File,
    photoData: { caption?: string; tags?: string[] },
    supabaseUserId: string,
  ): Promise<Photo> {
    // Vérifier que le point existe
    const point = await this.findOne(pointId);
    if (!point) {
      throw new NotFoundException('Point not found');
    }

    // Trouver l'utilisateur MongoDB à partir du supabaseId
    const user = await this.usersService.findBySupabaseId(supabaseUserId);
    if (!user || !user._id) {
      throw new BadRequestException('User not found');
    }

    // Upload la photo via le service photos
    const uploadedPhoto = await this.photosService.uploadPhoto(
      file,
      {
        pointId: pointId,
        caption: photoData.caption,
        tags: photoData.tags || [],
        isPublic: true,
      },
      user._id.toString(), // Utiliser l'ID MongoDB de l'utilisateur
    );

    // Mettre à jour les statistiques du point
    await this.pointModel.findByIdAndUpdate(pointId, {
      $inc: { 'statistics.totalPhotos': 1 },
    });

    return uploadedPhoto;
  }
}
