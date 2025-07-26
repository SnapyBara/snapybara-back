import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global search across all content' })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
  })
  globalSearch(
    @Query('q') query: string,
    @Query('types') types?: string,
    @Query('limit') limit?: number,
  ) {
    const typeArray = types ? types.split(',') : undefined;
    return this.searchService.globalSearch(query, { types: typeArray, limit });
  }

  @Get('area')
  @ApiOperation({ summary: 'Search points within a geographic area' })
  @ApiResponse({
    status: 200,
    description: 'Points in area retrieved successfully',
  })
  searchInArea(
    @Query('north') north: number,
    @Query('south') south: number,
    @Query('east') east: number,
    @Query('west') west: number,
    @Query('categories') categories?: string,
    @Query('minRating') minRating?: number,
  ) {
    const bounds = { north, south, east, west };
    const filters: any = {};

    if (categories) {
      filters.categories = categories.split(',');
    }

    if (minRating) {
      filters.minRating = minRating;
    }

    return this.searchService.searchPointsInArea(bounds, filters);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get search suggestions' })
  @ApiResponse({
    status: 200,
    description: 'Suggestions retrieved successfully',
  })
  getSuggestions(@Query('q') query: string) {
    return this.searchService.searchSuggestions(query);
  }
}
