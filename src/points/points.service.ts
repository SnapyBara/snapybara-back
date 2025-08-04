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
import * as sharp from 'sharp';

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
  ) {}

  /**
   * Convertir les catégories enum en strings minuscules pour MongoDB
   */
  private categoriesToStrings(categories?: POICategory[]): string[] | undefined {
    if (!categories) return undefined;
    return categories.map(cat => 
      typeof cat === 'string' ? cat.toLowerCase() : cat
    );
  }

  async create(
    createPointDto: CreatePointOfInterestDto,
    userId: string,
  ): Promise<PointOfInterest> {
    const createdPoint = new this.pointModel({
      ...createPointDto,
      location: {
        type: 'Point',
        coordinates: [createPointDto.longitude, createPointDto.latitude],
      },
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

  /**
   * Créer un point d'intérêt avec des photos
   */
  async createWithPhotos(
    createPointWithPhotosDto: CreatePointWithPhotosDto,
    userId: string,
  ): Promise<{
    point: PointOfInterest;
    photos: Photo[];
  }> {
    const session = await this.pointModel.db.startSession();
    session.startTransaction();

    try {
      // 1. Créer le point d'intérêt
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
        userId: new Types.ObjectId(userId),
        status: 'pending', // En attente de validation
        isPublic: createPointWithPhotosDto.isPublic ?? true,
        tags: createPointWithPhotosDto.tags || [],
        address: createPointWithPhotosDto.address,
        metadata: {
          ...createPointWithPhotosDto.metadata,
          googlePlaceId: createPointWithPhotosDto.googlePlaceId,
          bestTimeToVisit: createPointWithPhotosDto.bestTimeToVisit,
          accessibilityInfo: createPointWithPhotosDto.accessibilityInfo,
          photographyTips: createPointWithPhotosDto.photographyTips,
          isFreeAccess: createPointWithPhotosDto.isFreeAccess,
          requiresPermission: createPointWithPhotosDto.requiresPermission,
          difficulty: createPointWithPhotosDto.difficulty,
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

      // 2. Traiter et sauvegarder les photos
      const uploadedPhotos: Photo[] = [];

      for (const photoDto of createPointWithPhotosDto.photos) {
        try {
          let photoData;

          // Si c'est une base64, la convertir en buffer
          if (photoDto.imageData.startsWith('data:image')) {
            const matches = photoDto.imageData.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!matches) {
              throw new BadRequestException('Invalid base64 image format');
            }

            const imageBuffer = Buffer.from(matches[2], 'base64');
            const mimeType = `image/${matches[1]}`;

            // Créer un faux objet Multer.File
            const file: Express.Multer.File = {
              buffer: imageBuffer,
              mimetype: mimeType,
              originalname: `photo-${Date.now()}.${matches[1]}`,
              size: imageBuffer.length,
              fieldname: 'photo',
              encoding: '7bit',
              destination: '',
              filename: '',
              path: '',
              stream: null as any,
            };

            // Utiliser le service d'upload
            photoData = await this.uploadService.uploadPhoto(file, userId);
          } else if (photoDto.imageData.startsWith('http')) {
            // Si c'est une URL, la télécharger d'abord
            const response = await fetch(photoDto.imageData);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            
            const file: Express.Multer.File = {
              buffer,
              mimetype: contentType,
              originalname: `photo-${Date.now()}.jpg`,
              size: buffer.length,
              fieldname: 'photo',
              encoding: '7bit',
              destination: '',
              filename: '',
              path: '',
              stream: null as any,
            };

            photoData = await this.uploadService.uploadPhoto(file, userId);
          } else {
            throw new BadRequestException('Invalid image data format');
          }

          // Extraire les données EXIF si disponibles
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

          // Créer la photo dans la base de données
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
            userId,
            session,
          );

          uploadedPhotos.push(photo);
        } catch (error) {
          this.logger.error('Error uploading photo:', error);
          // Continuer avec les autres photos en cas d'erreur
        }
      }

      // 3. Mettre à jour les statistiques du point si des photos ont été uploadées
      if (uploadedPhotos.length > 0) {
        await this.pointModel.updateOne(
          { _id: createdPoint._id },
          { 
            $set: { 
              'statistics.totalPhotos': uploadedPhotos.length 
            } 
          },
          { session },
        );
      }

      await session.commitTransaction();

      // 4. Récupérer le point avec les informations de l'utilisateur
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

    // Convertir les catégories enum en strings pour MongoDB
    const categoriesAsStrings = this.categoriesToStrings(filters.categories);

    // Si on a une recherche géographique, utiliser l'agrégation avec $geoNear
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

      // Ajouter les filtres dans le $match après $geoNear
      const matchConditions: any = {};

      if (categoriesAsStrings && categoriesAsStrings.length > 0) {
        matchConditions.category = { $in: categoriesAsStrings };
      }

      if (filters.minRating) {
        matchConditions['statistics.averageRating'] = { $gte: filters.minRating };
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

      // Ajouter le tri
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
          // Par défaut, trier par distance (déjà fait par $geoNear)
          sortField = { distance: 1 };
      }
      
      if (Object.keys(sortField).length > 0 && filters.sortBy !== 'distance') {
        pipeline.push({ $sort: sortField });
      }

      // Ajouter la pagination
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      // Ajouter le lookup pour populate userId
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

  /**
   * Recherche hybride : MongoDB d'abord, puis OpenStreetMap/Overpass pour combler les manques
   */
  async searchHybrid(searchDto: SearchPointsDto): Promise<{
    data: PointOfInterest[];
    total: number;
    page: number;
    limit: number;
    sources: { mongodb: number; openstreetmap: number };
  }> {
    const { page = 1, limit = 20 } = searchDto;
    
    // Limiter à 50 points maximum pour économiser les ressources
    const effectiveLimit = Math.min(limit, 50);
    
    // 1. Chercher d'abord dans MongoDB (priorité)
    const mongoResults = await this.findAll({
      ...searchDto,
      limit: effectiveLimit
    });
    
    let finalResults = [...mongoResults.data];
    let osmCount = 0;
    
    // 2. Si pas assez de résultats et qu'on a des coordonnées, compléter avec OSM
    const remainingSlots = effectiveLimit - mongoResults.data.length;
    
    if (remainingSlots > 0 && searchDto.latitude && searchDto.longitude && searchDto.includeGooglePlaces) {
      this.logger.debug(`MongoDB returned ${mongoResults.data.length} results, fetching ${remainingSlots} more from OSM`);
      
      try {
        // Utiliser le service Overpass pour récupérer des POIs OSM
        const osmResults = await this.overpassService.searchPOIs(
          searchDto.latitude,
          searchDto.longitude,
          searchDto.radius || 3, // Rayon en km
          searchDto.categories?.map(cat => cat.toLowerCase()),
        );
        
        // Filtrer les résultats OSM qui existent déjà
        const filteredOSMResults = await this.filterExistingPlaces(osmResults);
        
        // Convertir les résultats OSM en format PointOfInterest
        for (const osmPOI of filteredOSMResults) {
          if (finalResults.length >= effectiveLimit) break;
          
          // Mapper le type OSM vers nos catégories
          const category = this.mapOSMTypeToCategory(osmPOI.type);
          
          // Filtrer par catégorie si spécifiée
          if (searchDto.categories && searchDto.categories.length > 0) {
            const categoriesAsStrings = this.categoriesToStrings(searchDto.categories);
            if (!categoriesAsStrings?.includes(category)) {
              continue;
            }
          }
          
          // Créer un objet temporaire qui ressemble à un PointOfInterest
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
              formattedAddress: osmPOI.tags['addr:full'] || 
                    `${osmPOI.tags['addr:street'] || ''} ${osmPOI.tags['addr:housenumber'] || ''}`.trim() ||
                    osmPOI.tags['addr:city'] || null,
              street: osmPOI.tags['addr:street'] || null,
              city: osmPOI.tags['addr:city'] || null,
              postalCode: osmPOI.tags['addr:postcode'] || null,
              country: osmPOI.tags['addr:country'] || null
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
          osmCount++;
        }
        
        this.logger.debug(`Added ${osmCount} POIs from OpenStreetMap`);
      } catch (error) {
        this.logger.error('Error fetching OSM results:', error);
      }
    }
    
    return {
      data: finalResults.slice(0, effectiveLimit),
      total: mongoResults.total + osmCount,
      page,
      limit: effectiveLimit,
      sources: {
        mongodb: mongoResults.data.length,
        openstreetmap: osmCount,
      },
    };
  }

  /**
   * Mapper les types OSM vers nos catégories
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
   * Générer une description depuis les tags OSM
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
   * Extraire des tags pertinents depuis OSM
   */
  private extractTags(osmPOI: any): string[] {
    const tags: string[] = [];
    
    if (osmPOI.type) tags.push(osmPOI.type);
    if (osmPOI.tags['tourism']) tags.push(osmPOI.tags['tourism']);
    if (osmPOI.tags['historic']) tags.push(osmPOI.tags['historic']);
    if (osmPOI.tags['amenity']) tags.push(osmPOI.tags['amenity']);
    if (osmPOI.tags['heritage']) tags.push('patrimoine');
    if (osmPOI.tags['wikipedia']) tags.push('wikipedia');
    
    return [...new Set(tags)]; // Dédupliquer
  }

  /**
   * Recherche dans Google Places
   */
  private async searchGooglePlaces(searchDto: SearchPointsDto, limit: number): Promise<any[]> {
    const { latitude, longitude, search, radius = 10 } = searchDto;
    
    if (!latitude || !longitude) {
      return [];
    }

    // S'assurer que le rayon ne dépasse pas 50km (limite Google Places)
    const safeRadius = Math.min(radius, 50);
    const radiusInMeters = safeRadius * 1000; // Convertir km en mètres

    let results: any[] = [];

    // Si on cherche spécifiquement dans la catégorie montagne, ajouter des mots-clés pertinents
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

    // Recherche textuelle si un terme de recherche est fourni
    if (search) {
      const textResults = await this.googlePlacesService.textSearch({
        query: search,
        latitude,
        longitude,
        radius: radiusInMeters,
      });
      results = results.concat(textResults);
    }

    // Recherche à proximité pour compléter
    if (results.length < limit) {
      const nearbyResults = await this.googlePlacesService.nearbySearch({
        latitude,
        longitude,
        radius: radiusInMeters,
        keyword: search,
      });
      
      // Éviter les doublons
      const existingPlaceIds = new Set(results.map(r => r.place_id));
      const uniqueNearbyResults = nearbyResults.filter(r => !existingPlaceIds.has(r.place_id));
      
      results = results.concat(uniqueNearbyResults);
    }

    // Si on cherche des lieux naturels et qu'on a peu de résultats, faire une recherche spécifique
    if (results.length < limit / 2) {
      const natureKeywords = ['viewpoint', 'belvédère', 'panorama', 'site naturel'];
      for (const keyword of natureKeywords) {
        if (results.length >= limit) break;
        
        const natureResults = await this.googlePlacesService.textSearch({
          query: keyword,
          latitude,
          longitude,
          radius: radiusInMeters,
        });
        
        const existingPlaceIds = new Set(results.map(r => r.place_id));
        const uniqueResults = natureResults.filter(r => !existingPlaceIds.has(r.place_id));
        results = results.concat(uniqueResults);
      }
    }

    // Dédupliquer une dernière fois
    const uniqueResults = Array.from(
      new Map(results.map(item => [item.place_id, item])).values()
    );

    return uniqueResults.slice(0, limit);
  }

  /**
   * Filtrer les lieux OSM qui existent déjà dans MongoDB
   */
  private async filterExistingPlaces(osmResults: any): Promise<any[]> {
    if (!osmResults || !osmResults.data || osmResults.data.length === 0) return [];

    const osmPOIs = osmResults.data;
    
    // Rechercher dans MongoDB par osmId dans les métadonnées
    const osmIds = osmPOIs.map(poi => poi.id);
    
    const existingPlaces = await this.pointModel
      .find({
        'metadata.osmId': { $in: osmIds }
      })
      .select('metadata.osmId')
      .exec();

    const existingOsmIds = new Set(
      existingPlaces.map(place => place.metadata?.osmId)
    );

    // Filtrer aussi par proximité géographique pour éviter les doublons
    const filtered: any[] = [];
    
    for (const poi of osmPOIs) {
      // Skip si déjà existant par OSM ID
      if (existingOsmIds.has(poi.id)) {
        continue;
      }

      // Vérifier la proximité géographique (éviter les doublons à moins de 100m)
      // Utiliser une requête aggregate au lieu de $near dans un $or
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
   * Obtenir les détails d'un lieu depuis Google Places et l'ajouter optionnellement à MongoDB
   */
  async getPlaceFromGooglePlaces(placeId: string, saveToMongoDB: boolean = false): Promise<any> {
    const googlePlace = await this.googlePlacesService.getPlaceDetails(placeId);
    
    if (!googlePlace) {
      throw new NotFoundException('Place not found in Google Places');
    }

    const convertedPlace = this.googlePlacesService.convertToPointOfInterest(googlePlace);

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
          const convertedPlace = this.googlePlacesService.convertToPointOfInterest(googlePlace);
          
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
          this.logger.error(`Error importing place ${googlePlace.place_id}:`, error);
          errors++;
        }
      }

      skipped = filteredPlaces.length - placesToImport.length;
      
      this.logger.log(`Import completed: ${imported} imported, ${skipped} skipped, ${errors} errors`);
      
    } catch (error) {
      this.logger.error('Error during Google Places import:', error);
      errors++;
    }

    return { imported, skipped, errors };
  }
}
