import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CollectionsService } from './collections.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@ApiTags('collections')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new collection' })
  create(@Body() createCollectionDto: any, @Request() req) {
    return this.collectionsService.create(createCollectionDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all collections' })
  findAll(
    @Query('userId') userId?: string,
    @Query('isPublic') isPublic?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.collectionsService.findAll({ userId, isPublic, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a collection by ID' })
  findOne(@Param('id') id: string) {
    return this.collectionsService.findOne(id);
  }

  @Post(':id/points/:pointId')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a point to collection' })
  addPoint(
    @Param('id') id: string,
    @Param('pointId') pointId: string,
    @Request() req,
  ) {
    return this.collectionsService.addPoint(id, pointId, req.user.id);
  }

  @Delete(':id/points/:pointId')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove a point from collection' })
  removePoint(
    @Param('id') id: string,
    @Param('pointId') pointId: string,
    @Request() req,
  ) {
    return this.collectionsService.removePoint(id, pointId, req.user.id);
  }

  @Post(':id/follow')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Toggle follow on a collection' })
  toggleFollow(@Param('id') id: string, @Request() req) {
    return this.collectionsService.toggleFollow(id, req.user.id);
  }
}
