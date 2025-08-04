import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OverpassService, OverpassPOI } from './overpass.service';
import { PhotoEnrichmentService } from './photo-enrichment.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@ApiTags('overpass')
@Controller('overpass')
export class OverpassController {
  constructor(
    private readonly overpassService: OverpassService,
    private readonly photoEnrichmentService: PhotoEnrichmentService,
  ) {}

  @Get('search')
  @ApiOperation({ 
    summary: 'Search POIs from OpenStreetMap/Overpass with caching' 
  })
  @ApiQuery({ name: 'lat', type: Number, required: true })
  @ApiQuery({ name: 'lon', type: Number, required: true })
  @ApiQuery({ name: 'radius', type: Number, required: false, description: 'Radius in km (max 5)' })
  @ApiQuery({ name: 'categories', type: String, required: false, isArray: true })
  @ApiResponse({
    status: 200,
    description: 'POIs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string' },
              lat: { type: 'number' },
              lon: { type: 'number' },
              tags: { type: 'object' },
              source: { type: 'string', enum: ['overpass', 'nominatim', 'cached'] },
            },
          },
        },
        sources: {
          type: 'object',
          properties: {
            cached: { type: 'number' },
            overpass: { type: 'number' },
            nominatim: { type: 'number' },
          },
        },
        executionTime: { type: 'number' },
      },
    },
  })
  async searchPOIs(
    @Query('lat') lat: number,
    @Query('lon') lon: number,
    @Query('radius') radius: number = 3,
    @Query('categories') categories?: string[],
  ) {
    return this.overpassService.searchPOIs(lat, lon, radius, categories);
  }

  @Get('search-with-photos')
  @ApiOperation({ 
    summary: 'Search POIs with photos from Wikimedia/Unsplash' 
  })
  @ApiQuery({ name: 'lat', type: Number, required: true })
  @ApiQuery({ name: 'lon', type: Number, required: true })
  @ApiQuery({ name: 'radius', type: Number, required: false, description: 'Radius in km (max 5)' })
  @ApiQuery({ name: 'categories', type: String, required: false, isArray: true })
  @ApiQuery({ name: 'includePhotos', type: Boolean, required: false, description: 'Include photos for each POI' })
  @ApiResponse({
    status: 200,
    description: 'POIs with photos retrieved successfully',
  })
  async searchPOIsWithPhotos(
    @Query('lat') lat: number,
    @Query('lon') lon: number,
    @Query('radius') radius: number = 3,
    @Query('categories') categories?: string[],
    @Query('includePhotos') includePhotos: boolean = true,
  ) {
    // Récupérer les POIs
    const poisResult = await this.overpassService.searchPOIs(lat, lon, radius, categories);
    
    if (!includePhotos || poisResult.data.length === 0) {
      return poisResult;
    }

    // Enrichir avec des photos
    const enrichedPOIs = await this.photoEnrichmentService.enrichPOIsWithPhotos(
      poisResult.data.slice(0, 20), // Limiter à 20 POIs pour éviter trop de requêtes
    );

    return {
      ...poisResult,
      data: enrichedPOIs,
    };
  }

  @Get('preload')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Preload POIs for a specific area (admin only)' 
  })
  @ApiQuery({ name: 'lat', type: Number, required: true })
  @ApiQuery({ name: 'lon', type: Number, required: true })
  @ApiQuery({ name: 'radius', type: Number, required: false })
  async preloadArea(
    @Query('lat') lat: number,
    @Query('lon') lon: number,
    @Query('radius') radius: number = 5,
    @Request() req,
  ) {
    // Vérifier si l'utilisateur est admin (à implémenter selon votre logique)
    if (!req.user?.isAdmin) {
      throw new Error('Unauthorized');
    }
    
    await this.overpassService.preloadArea(lat, lon, radius);
    return { message: 'Area preloaded successfully' };
  }

  @Get('preload-popular')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Preload popular Paris areas (admin only)' 
  })
  async preloadPopularAreas(@Request() req) {
    // Vérifier si l'utilisateur est admin
    if (!req.user?.isAdmin) {
      throw new Error('Unauthorized');
    }
    
    await this.overpassService.preloadPopularAreas();
    return { message: 'Popular areas preloaded successfully' };
  }

  @Get('warm-cache')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Warm up the cache (admin only)' 
  })
  async warmCache(@Request() req) {
    // Vérifier si l'utilisateur est admin
    if (!req.user?.isAdmin) {
      throw new Error('Unauthorized');
    }
    
    await this.overpassService.warmCache();
    return { message: 'Cache warmed successfully' };
  }
}
