import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PointsService } from './points.service';
import 'multer';
import { CreatePointOfInterestDto } from './dto/create-point.dto';
import { UpdatePointOfInterestDto } from './dto/update-point.dto';
import { SearchPointsDto } from './dto/search-points.dto';
import { SearchHybridDto } from './dto/search-hybrid.dto';
import { ImportGooglePlacesDto } from './dto/import-google-places.dto';
import { CreatePointWithPhotosDto } from './dto/create-point-with-photos.dto';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { PhotosService } from '../photos/photos.service';
import { ReviewsService } from '../reviews/reviews.service';

@ApiTags('points')
@Controller('points')
export class PointsController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly photosService: PhotosService,
    private readonly reviewsService: ReviewsService,
  ) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new point of interest' })
  @ApiResponse({ status: 201, description: 'Point created successfully' })
  async create(
    @Body() createPointDto: CreatePointOfInterestDto,
    @Request() req,
  ) {
    try {
      // Valider et nettoyer les données contre les injections NoSQL
      if (createPointDto && typeof createPointDto === 'object') {
        // Vérifier si des opérateurs MongoDB sont présents
        const hasMongoOperators = (obj: any): boolean => {
          if (!obj || typeof obj !== 'object') return false;
          return Object.keys(obj).some((key) => key.startsWith('$'));
        };

        // Rejeter si des opérateurs MongoDB sont détectés
        const checkField = (value: any, fieldName: string) => {
          if (hasMongoOperators(value)) {
            throw new BadRequestException(`Invalid ${fieldName} format`);
          }
        };

        // Vérifier les champs sensibles s'ils existent
        // Note: userId n'est pas dans le DTO, il vient du token JWT

        // S'assurer que les coordonnées sont des nombres valides
        if (isNaN(createPointDto.latitude) || isNaN(createPointDto.longitude)) {
          throw new BadRequestException('Invalid coordinates');
        }
      }

      return await this.pointsService.create(createPointDto, req.user.id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error creating point:', error);
      throw new BadRequestException('Failed to create point');
    }
  }

  @Post('with-photos')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new point of interest with photos' })
  @ApiResponse({
    status: 201,
    description: 'Point created successfully with photos',
    schema: {
      type: 'object',
      properties: {
        point: { type: 'object' },
        photos: { type: 'array' },
      },
    },
  })
  createWithPhotos(
    @Body() createPointWithPhotosDto: CreatePointWithPhotosDto,
    @Request() req,
  ) {
    return this.pointsService.createWithPhotos(
      createPointWithPhotosDto,
      req.user.id,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Search points of interest' })
  @ApiResponse({ status: 200, description: 'Points retrieved successfully' })
  async findAll(@Query() searchDto: SearchPointsDto) {
    try {
      // Valider et nettoyer les paramètres de recherche
      if (searchDto.search && typeof searchDto.search === 'string') {
        // Nettoyer les injections potentielles
        const cleanSearch = searchDto.search.replace(/[{}$]/g, '');
        if (cleanSearch !== searchDto.search) {
          // Si le search contient des caractères suspects, le nettoyer
          searchDto.search = cleanSearch;
        }
      }

      return await this.pointsService.findAll(searchDto);
    } catch (error) {
      // Log l'erreur mais retourner un résultat vide plutôt qu'une erreur 500
      console.error('Error in findAll:', error);
      return {
        data: [],
        total: 0,
        page: searchDto.page || 1,
        limit: searchDto.limit || 20,
      };
    }
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby points of interest' })
  @ApiResponse({
    status: 200,
    description: 'Nearby points retrieved successfully',
  })
  getNearby(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('radius') radius?: number,
  ) {
    return this.pointsService.findNearby(latitude, longitude, radius);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get points by user' })
  @ApiResponse({
    status: 200,
    description: 'User points retrieved successfully',
  })
  getByUser(@Param('userId') userId: string) {
    return this.pointsService.findByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a point by ID' })
  @ApiResponse({ status: 200, description: 'Point retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Point not found' })
  findOne(@Param('id') id: string) {
    return this.pointsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a point of interest' })
  @ApiResponse({ status: 200, description: 'Point updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updatePointDto: UpdatePointOfInterestDto,
    @Request() req,
  ) {
    return this.pointsService.update(id, updatePointDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a point of interest' })
  @ApiResponse({ status: 200, description: 'Point deleted successfully' })
  remove(@Param('id') id: string, @Request() req) {
    return this.pointsService.remove(id, req.user.id);
  }

  @Get('search/app')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'App search: returns MongoDB data for all users, adds Google Places for premium users',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results with source information',
  })
  async searchForApp(@Query() searchDto: SearchHybridDto, @Request() req) {
    const isPremium = req.user?.isPremium || false;

    if (isPremium && searchDto.useGooglePlaces) {
      return this.pointsService.searchHybrid({
        ...searchDto,
        includeGooglePlaces: true,
      });
    }

    return this.pointsService.findAll(searchDto);
  }

  @Get('search/hybrid')
  @ApiOperation({ summary: 'Hybrid search: MongoDB first, then Google Places' })
  @ApiResponse({
    status: 200,
    description: 'Hybrid search results with source information',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array' },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        sources: {
          type: 'object',
          properties: {
            mongodb: { type: 'number' },
            googlePlaces: { type: 'number' },
          },
        },
      },
    },
  })
  searchHybrid(@Query() searchDto: SearchPointsDto) {
    return this.pointsService.searchHybrid({
      ...searchDto,
      includeGooglePlaces: searchDto.includeGooglePlaces ?? false,
      includeOpenStreetMap: searchDto.includeOpenStreetMap ?? true,
    });
  }

  @Post('enrich-photos')
  @ApiOperation({ summary: 'Enrich multiple POIs with photos' })
  @ApiQuery({
    name: 'osmIds',
    type: [String],
    description: 'OSM IDs to enrich',
  })
  @ApiResponse({
    status: 200,
    description: 'POIs enriched with photos',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            source: { type: 'string' },
            attribution: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
          },
        },
      },
    },
  })
  async enrichPhotos(@Body() body: { pois: any[] }) {
    return this.pointsService.enrichPOIsWithPhotos(body.pois);
  }

  @Get('google-places/:placeId')
  @ApiOperation({ summary: 'Get place details from Google Places API' })
  @ApiResponse({
    status: 200,
    description: 'Google Place details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Place not found in Google Places' })
  getGooglePlace(
    @Param('placeId') placeId: string,
    @Query('save') save?: boolean,
  ) {
    return this.pointsService.getPlaceFromGooglePlaces(placeId, save === true);
  }

  @Post('import/google-places')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Import places from Google Places API in a geographic area',
  })
  @ApiResponse({
    status: 200,
    description: 'Import completed',
    schema: {
      type: 'object',
      properties: {
        imported: { type: 'number' },
        skipped: { type: 'number' },
        errors: { type: 'number' },
      },
    },
  })
  importFromGooglePlaces(@Body() importDto: ImportGooglePlacesDto) {
    const { latitude, longitude, radiusKm, maxPlaces } = importDto;
    return this.pointsService.importFromGooglePlaces(
      latitude,
      longitude,
      radiusKm,
      maxPlaces,
    );
  }

  // Administration endpoints
  @Get('admin/pending')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all pending points for moderation' })
  @ApiResponse({
    status: 200,
    description: 'Pending points retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getPendingPoints(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Request() req?,
  ) {
    // TODO: Add admin role check
    return this.pointsService.getPendingPoints(page || 1, limit || 20);
  }

  @Get('admin/all')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all points with filtering options' })
  @ApiResponse({
    status: 200,
    description: 'All points retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  getAllPoints(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Request() req?,
  ) {
    // TODO: Add admin role check
    return this.pointsService.getAllPointsAdmin({
      page: page || 1,
      limit: limit || 20,
      status,
      category,
      search,
    });
  }

  @Patch('admin/:id/approve')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Approve a pending point' })
  @ApiResponse({ status: 200, description: 'Point approved successfully' })
  approvePoint(@Param('id') id: string, @Request() req) {
    // TODO: Add admin role check
    return this.pointsService.updatePointStatus(id, 'approved', req.user.id);
  }

  @Patch('admin/:id/reject')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Reject a pending point' })
  @ApiResponse({ status: 200, description: 'Point rejected successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
      },
    },
  })
  rejectPoint(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req,
  ) {
    // TODO: Add admin role check
    return this.pointsService.updatePointStatus(
      id,
      'rejected',
      req.user.id,
      reason,
    );
  }

  @Delete('admin/:id')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a point permanently (admin only)' })
  @ApiResponse({ status: 200, description: 'Point deleted permanently' })
  adminDeletePoint(@Param('id') id: string, @Request() req) {
    // TODO: Add admin role check
    return this.pointsService.adminDeletePoint(id, req.user.id);
  }

  @Get('admin/stats')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get moderation statistics' })
  @ApiResponse({
    status: 200,
    description: 'Moderation statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        pendingCount: { type: 'number' },
        approvedToday: { type: 'number' },
        rejectedToday: { type: 'number' },
        totalPOIs: { type: 'number' },
        activeUsers: { type: 'number' },
        recentSubmissions: { type: 'array' },
      },
    },
  })
  getModerationStats(@Request() req) {
    return this.pointsService.getModerationStats();
  }

  @Get(':id/photos')
  @ApiOperation({ summary: 'Get all photos for a specific point' })
  @ApiResponse({
    status: 200,
    description: 'Photos retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          url: { type: 'string' },
          thumbnailUrl: { type: 'string' },
          mediumUrl: { type: 'string' },
          caption: { type: 'string' },
          metadata: { type: 'object' },
          createdAt: { type: 'string' },
        },
      },
    },
  })
  getPointPhotos(@Param('id') id: string) {
    return this.pointsService.getPointPhotos(id);
  }

  @Post(':id/photos')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(FileInterceptor('photo'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Upload a photo for a specific point' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
        },
        caption: {
          type: 'string',
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
  })
  async uploadPointPhoto(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() body: { caption?: string; tags?: string[] },
    @Request() req,
  ) {
    // Upload la photo pour ce point via le PointsService
    return this.pointsService.uploadPhotoForPoint(
      id,
      file,
      {
        caption: body.caption,
        tags: body.tags,
      },
      req.user.id,
    );
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Get reviews for a specific point' })
  @ApiResponse({
    status: 200,
    description: 'Reviews retrieved successfully',
  })
  async getPointReviews(@Param('id') id: string) {
    console.log('Getting reviews for point:', id);
    const result = await this.reviewsService.findAll({ pointId: id });
    console.log('Found reviews:', result.data.length);
    return result;
  }

  @Post(':id/reviews')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a review to a specific point' })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully',
  })
  async addPointReview(
    @Param('id') id: string,
    @Body() body: { rating: number; comment: string },
    @Request() req,
  ) {
    try {
      console.log('Creating review for point:', id);
      console.log('Review data:', body);
      console.log('User ID:', req.user.id);

      // Nettoyer le commentaire contre XSS (mais le stocker tel quel)
      // L'échappement se fera à l'affichage
      if (body.comment && typeof body.comment !== 'string') {
        throw new BadRequestException('Invalid comment format');
      }

      // Vérifier que le point existe
      const point = await this.pointsService.findOne(id);
      if (!point) {
        throw new NotFoundException('Point not found');
      }

      const result = await this.reviewsService.create(
        {
          pointId: id,
          rating: body.rating,
          comment: body.comment,
        },
        req.user.id,
      );

      console.log('Review created:', result);
      return result;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      console.error('Error creating review:', error);
      // Retourner 409 si c'est probablement une contrainte unique (review déjà existante)
      if (error.code === 11000) {
        throw new BadRequestException('You have already reviewed this point');
      }
      throw new BadRequestException('Failed to create review');
    }
  }
}
