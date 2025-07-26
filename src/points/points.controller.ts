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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PointsService } from './points.service';
import { CreatePointOfInterestDto } from './dto/create-point.dto';
import { UpdatePointOfInterestDto } from './dto/update-point.dto';
import { SearchPointsDto } from './dto/search-points.dto';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@ApiTags('points')
@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new point of interest' })
  @ApiResponse({ status: 201, description: 'Point created successfully' })
  create(@Body() createPointDto: CreatePointOfInterestDto, @Request() req) {
    return this.pointsService.create(createPointDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Search points of interest' })
  @ApiResponse({ status: 200, description: 'Points retrieved successfully' })
  findAll(@Query() searchDto: SearchPointsDto) {
    return this.pointsService.findAll(searchDto);
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
  @ApiBearerAuth()
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a point of interest' })
  @ApiResponse({ status: 200, description: 'Point deleted successfully' })
  remove(@Param('id') id: string, @Request() req) {
    return this.pointsService.remove(id, req.user.id);
  }
}
