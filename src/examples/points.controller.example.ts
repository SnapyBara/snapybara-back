import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/guards/auth.guard';
import { CurrentUserRest } from '../common/decorators/current-user.decorator';
import { SupabaseService } from '../supabase/supabase.service';
import {
  PointOfInterest,
  POICategory,
  SearchFilters,
} from '../types/app.types';
import {
  calculateDistance,
  calculateBoundingBox,
  findNearestPoints,
} from '../common/helpers/geo.helpers';

/**
 * EXEMPLE : Contrôleur de gestion des points d'intérêt
 * Montre l'utilisation de la géolocalisation et des requêtes spatiales avec Supabase
 */

interface CreatePOIDto {
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  category: POICategory;
  is_public?: boolean;
}

interface UpdatePOIDto extends Partial<CreatePOIDto> {}

interface SearchQueryDto {
  lat?: number;
  lon?: number;
  radius?: number;
  category?: POICategory;
  rating_min?: number;
  is_public?: boolean;
  limit?: number;
  page?: number;
}

@ApiTags('points-of-interest')
@Controller('points')
export class PointsController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('search')
  @ApiOperation({ summary: "Rechercher des points d'intérêt" })
  @ApiQuery({
    name: 'lat',
    required: false,
    description: 'Latitude de recherche',
  })
  @ApiQuery({
    name: 'lon',
    required: false,
    description: 'Longitude de recherche',
  })
  @ApiQuery({
    name: 'radius',
    required: false,
    description: 'Rayon de recherche en km',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['landscape', 'architecture', 'street_art'],
  })
  async searchPoints(@Query() query: SearchQueryDto) {
    const {
      lat,
      lon,
      radius = 10,
      category,
      rating_min,
      is_public = true,
      limit = 20,
      page = 1,
    } = query;

    let queryBuilder = this.supabaseService.client
      .from('points_of_interest')
      .select(
        `
        *,
        profiles:user_id (first_name, last_name, avatar_url),
        reviews (rating),
        photos (url)
      `,
      )
      .eq('is_public', is_public);

    // Filtrage par catégorie
    if (category) {
      queryBuilder = queryBuilder.eq('category', category);
    }

    // Si coordonnées fournies, filtrer par distance
    if (lat !== undefined && lon !== undefined) {
      const bbox = calculateBoundingBox(lat, lon, radius);
      queryBuilder = queryBuilder
        .gte('latitude', bbox.south)
        .lte('latitude', bbox.north)
        .gte('longitude', bbox.west)
        .lte('longitude', bbox.east);
    }

    // Pagination
    const offset = (page - 1) * limit;
    queryBuilder = queryBuilder
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data: points, error, count } = await queryBuilder;

    if (error) {
      throw new BadRequestException('Erreur lors de la recherche');
    }

    // Calcul des distances si coordonnées fournies
    let processedPoints = points || [];
    if (lat !== undefined && lon !== undefined) {
      processedPoints =
        points
          ?.map(point => ({
            ...point,
            distance: calculateDistance(
              lat,
              lon,
              point.latitude,
              point.longitude,
            ),
            average_rating:
              point.reviews.length > 0
                ? point.reviews.reduce(
                    (sum: number, review: any) => sum + review.rating,
                    0,
                  ) / point.reviews.length
                : null,
            total_photos: point.photos.length,
          }))
          .filter(point => point.distance <= radius) // Filtrage précis par distance
          .sort((a, b) => a.distance - b.distance) || [];
    }

    // Filtrage par note minimum
    if (rating_min !== undefined) {
      processedPoints = processedPoints.filter(
        point =>
          point.average_rating !== null && point.average_rating >= rating_min,
      );
    }

    return {
      data: processedPoints,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  @Get('nearby')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Points d'intérêt à proximité de l'utilisateur" })
  async getNearbyPoints(
    @CurrentUserRest() user: User,
    @Query('lat') lat: number,
    @Query('lon') lon: number,
    @Query('radius') radius: number = 5,
  ) {
    if (!lat || !lon) {
      throw new BadRequestException('Latitude et longitude requises');
    }

    const { data: points, error } = await this.supabaseService.client
      .from('points_of_interest')
      .select(
        `
        *,
        profiles:user_id (first_name, last_name),
        reviews!left (rating),
        photos!left (id)
      `,
      )
      .eq('is_public', true);

    if (error) {
      throw new BadRequestException('Erreur lors de la récupération');
    }

    // Calcul des distances et tri
    const nearbyPoints = findNearestPoints(
      { latitude: lat, longitude: lon },
      points || [],
      10,
    ).filter(point => point.distance <= radius);

    return {
      user_location: { latitude: lat, longitude: lon },
      radius_km: radius,
      points: nearbyPoints.map(point => ({
        ...point,
        average_rating:
          point.reviews?.length > 0
            ? point.reviews.reduce((sum, review) => sum + review.rating, 0) /
              point.reviews.length
            : null,
        photos_count: point.photos?.length || 0,
      })),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: "Récupérer un point d'intérêt par ID" })
  async getPointById(@Param('id') id: string) {
    const { data: point, error } = await this.supabaseService.client
      .from('points_of_interest')
      .select(
        `
        *,
        profiles:user_id (first_name, last_name, avatar_url),
        reviews (
          *,
          profiles:user_id (first_name, last_name, avatar_url)
        ),
        photos (*)
      `,
      )
      .eq('id', id)
      .single();

    if (error || !point) {
      throw new NotFoundException("Point d'intérêt non trouvé");
    }

    // Calcul de la note moyenne
    const averageRating =
      point.reviews.length > 0
        ? point.reviews.reduce(
            (sum: number, review: any) => sum + review.rating,
            0,
          ) / point.reviews.length
        : null;

    return {
      ...point,
      average_rating: averageRating,
      total_reviews: point.reviews.length,
      total_photos: point.photos.length,
    };
  }

  @Post()
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Créer un nouveau point d'intérêt" })
  async createPoint(
    @CurrentUserRest() user: User,
    @Body() createData: CreatePOIDto,
  ): Promise<PointOfInterest> {
    // Validation des coordonnées
    if (
      createData.latitude < -90 ||
      createData.latitude > 90 ||
      createData.longitude < -180 ||
      createData.longitude > 180
    ) {
      throw new BadRequestException('Coordonnées GPS invalides');
    }

    // Vérification de duplication (points très proches)
    const { data: existingPoints } = await this.supabaseService.client
      .from('points_of_interest')
      .select('id, latitude, longitude')
      .eq('is_public', true);

    const nearbyExisting = existingPoints?.find(
      point =>
        calculateDistance(
          createData.latitude,
          createData.longitude,
          point.latitude,
          point.longitude,
        ) < 0.1, // 100 mètres
    );

    if (nearbyExisting) {
      throw new BadRequestException(
        "Un point d'intérêt existe déjà à proximité (< 100m)",
      );
    }

    const newPoint = {
      ...createData,
      user_id: user.id,
      is_public: createData.is_public ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdPoint, error } = await this.supabaseService.client
      .from('points_of_interest')
      .insert([newPoint])
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Erreur lors de la création du point');
    }

    return createdPoint;
  }

  @Put(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Mettre à jour un point d'intérêt" })
  async updatePoint(
    @CurrentUserRest() user: User,
    @Param('id') id: string,
    @Body() updateData: UpdatePOIDto,
  ): Promise<PointOfInterest> {
    // Vérifier que l'utilisateur est propriétaire
    const { data: existingPoint, error: fetchError } =
      await this.supabaseService.client
        .from('points_of_interest')
        .select('user_id')
        .eq('id', id)
        .single();

    if (fetchError || !existingPoint) {
      throw new NotFoundException("Point d'intérêt non trouvé");
    }

    if (existingPoint.user_id !== user.id) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres points',
      );
    }

    const updates = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedPoint, error } = await this.supabaseService.client
      .from('points_of_interest')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Erreur lors de la mise à jour');
    }

    return updatedPoint;
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Supprimer un point d'intérêt" })
  async deletePoint(
    @CurrentUserRest() user: User,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    // Vérifier propriété
    const { data: existingPoint, error: fetchError } =
      await this.supabaseService.client
        .from('points_of_interest')
        .select('user_id')
        .eq('id', id)
        .single();

    if (fetchError || !existingPoint) {
      throw new NotFoundException("Point d'intérêt non trouvé");
    }

    if (existingPoint.user_id !== user.id) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres points',
      );
    }

    const { error } = await this.supabaseService.client
      .from('points_of_interest')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException('Erreur lors de la suppression');
    }

    return { message: "Point d'intérêt supprimé avec succès" };
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: "Récupérer les avis d'un point d'intérêt" })
  async getPointReviews(@Param('id') id: string) {
    const { data: reviews, error } = await this.supabaseService.client
      .from('reviews')
      .select(
        `
        *,
        profiles:user_id (first_name, last_name, avatar_url)
      `,
      )
      .eq('point_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException('Erreur lors de la récupération des avis');
    }

    const averageRating =
      reviews?.length > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length
        : null;

    return {
      reviews: reviews || [],
      total_reviews: reviews?.length || 0,
      average_rating: averageRating,
    };
  }

  @Get('user/:userId')
  @ApiOperation({ summary: "Points d'intérêt d'un utilisateur spécifique" })
  async getUserPoints(@Param('userId') userId: string) {
    const { data: points, error } = await this.supabaseService.client
      .from('points_of_interest')
      .select(
        `
        *,
        reviews!left (rating),
        photos!left (id)
      `,
      )
      .eq('user_id', userId)
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException('Erreur lors de la récupération');
    }

    return {
      points:
        points?.map(point => ({
          ...point,
          average_rating:
            point.reviews?.length > 0
              ? point.reviews.reduce((sum, review) => sum + review.rating, 0) /
                point.reviews.length
              : null,
          photos_count: point.photos?.length || 0,
        })) || [],
      total: points?.length || 0,
    };
  }
}
