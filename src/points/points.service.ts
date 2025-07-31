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
import { GooglePlacesService } from '../google-places/google-places.service';

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    @InjectModel(PointOfInterest.name)
    private pointModel: Model<PointOfInterestDocument>,
    private googlePlacesService: GooglePlacesService,
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
   * Recherche hybride : MongoDB d'abord, puis Google Places pour combler les manques
   */
  async searchHybrid(searchDto: SearchPointsDto): Promise<{
    data: PointOfInterest[];
    total: number;
    page: number;
    limit: number;
    sources: { mongodb: number; googlePlaces: number };
  }> {
    const { page = 1, limit = 20 } = searchDto;
    
    // Limiter à 50 points maximum pour économiser les requêtes
    const effectiveLimit = Math.min(limit, 50);
    
    // 1. Chercher d'abord dans MongoDB (priorité)
    const mongoResults = await this.findAll({
      ...searchDto,
      limit: effectiveLimit
    });
    
    let finalResults = [...mongoResults.data];
    let googlePlacesCount = 0;
    
    // 2. Si pas assez de résultats, compléter avec Google Places
    const remainingSlots = effectiveLimit - mongoResults.data.length;
    
    if (remainingSlots > 0 && searchDto.latitude && searchDto.longitude) {
      this.logger.debug(`MongoDB returned ${mongoResults.data.length} results, fetching ${remainingSlots} more from Google Places`);
      
      try {
        const googleResults = await this.searchGooglePlaces(searchDto, remainingSlots * 2); // Récupérer plus pour pouvoir filtrer
        
        // Filtrer les résultats Google Places qui existent déjà dans MongoDB
        const filteredGoogleResults = await this.filterExistingPlaces(googleResults);
        
        // Convertir et filtrer les résultats Google Places par catégorie si nécessaire
        for (const googlePlace of filteredGoogleResults) {
          if (finalResults.length >= effectiveLimit) break;
          
          const convertedPlace = this.googlePlacesService.convertToPointOfInterest(googlePlace);
          
          // Filtrer par catégorie si spécifiée
          if (searchDto.categories && searchDto.categories.length > 0) {
            // Convertir les catégories en minuscules pour la comparaison
            const categoriesAsStrings = this.categoriesToStrings(searchDto.categories);
            if (!categoriesAsStrings?.includes(convertedPlace.category.toLowerCase())) {
              continue; // Passer au suivant si la catégorie ne correspond pas
            }
          }
          
          // Créer un objet temporaire qui ressemble à un PointOfInterest pour la réponse
          finalResults.push({
            ...convertedPlace,
            id: new Types.ObjectId().toString(), // ID temporaire
            location: {
              type: 'Point',
              coordinates: [convertedPlace.longitude, convertedPlace.latitude],
            },
            userId: null, // Pas d'utilisateur pour les résultats Google Places
            isPublic: true,
            isActive: true,
            status: 'approved',
            viewCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);
          googlePlacesCount++;
        }
      } catch (error) {
        this.logger.error('Error fetching Google Places results:', error);
      }
    }
    
    return {
      data: finalResults.slice(0, effectiveLimit), // S'assurer qu'on ne dépasse pas la limite
      total: mongoResults.total + googlePlacesCount,
      page,
      limit: effectiveLimit,
      sources: {
        mongodb: mongoResults.data.length,
        googlePlaces: googlePlacesCount,
      },
    };
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
   * Filtrer les lieux Google Places qui existent déjà dans MongoDB
   */
  private async filterExistingPlaces(googlePlaces: any[]): Promise<any[]> {
    if (googlePlaces.length === 0) return [];

    // Rechercher dans MongoDB par googlePlaceId dans les métadonnées
    const googlePlaceIds = googlePlaces.map(place => place.place_id);
    
    const existingPlaces = await this.pointModel
      .find({
        'metadata.googlePlaceId': { $in: googlePlaceIds }
      })
      .select('metadata.googlePlaceId')
      .exec();

    const existingGooglePlaceIds = new Set(
      existingPlaces.map(place => place.metadata?.googlePlaceId)
    );

    // Filtrer aussi par proximité géographique pour éviter les doublons
    const filtered: any[] = [];
    
    for (const googlePlace of googlePlaces) {
      // Skip si déjà existant par Google Place ID
      if (existingGooglePlaceIds.has(googlePlace.place_id)) {
        continue;
      }

      // Vérifier la proximité géographique (éviter les doublons à moins de 100m)
      const nearbyExisting = await this.pointModel.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [googlePlace.geometry.location.lng, googlePlace.geometry.location.lat],
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
        filtered.push(googlePlace);
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
