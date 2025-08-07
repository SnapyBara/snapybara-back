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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PhotosService } from './photos.service';
import { CreatePhotoDto, UploadPhotoDto } from './dto/create-photo.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@ApiTags('photos')
@Controller('photos')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new photo entry' })
  @ApiResponse({ status: 201, description: 'Photo created successfully' })
  create(@Body() createPhotoDto: CreatePhotoDto, @Request() req) {
    return this.photosService.create(createPhotoDto, req.user.id);
  }

  @Post('upload')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(FileInterceptor('photo'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Upload a photo file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
        },
        pointId: {
          type: 'string',
        },
        caption: {
          type: 'string',
        },
        isPublic: {
          type: 'boolean',
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
  uploadPhoto(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() uploadPhotoDto: UploadPhotoDto,
    @Request() req,
  ) {
    // Validate the file and upload it
    return {
      message: 'Photo upload endpoint - implement storage integration',
      file: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all photos' })
  @ApiResponse({ status: 200, description: 'Photos retrieved successfully' })
  findAll(
    @Query('pointId') pointId?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.photosService.findAll({ pointId, userId, page, limit });
  }

  @Get('top')
  @ApiOperation({ summary: 'Get top photos' })
  @ApiResponse({
    status: 200,
    description: 'Top photos retrieved successfully',
  })
  getTopPhotos(@Query('limit') limit?: number) {
    return this.photosService.getTopPhotos(limit);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent photos' })
  @ApiResponse({
    status: 200,
    description: 'Recent photos retrieved successfully',
  })
  getRecentPhotos(@Query('limit') limit?: number) {
    return this.photosService.getRecentPhotos(limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a photo by ID' })
  @ApiResponse({ status: 200, description: 'Photo retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Photo not found' })
  findOne(@Param('id') id: string) {
    return this.photosService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a photo' })
  @ApiResponse({ status: 200, description: 'Photo updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updatePhotoDto: UpdatePhotoDto,
    @Request() req,
  ) {
    return this.photosService.update(id, updatePhotoDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a photo' })
  @ApiResponse({ status: 200, description: 'Photo deleted successfully' })
  remove(@Param('id') id: string, @Request() req) {
    return this.photosService.remove(id, req.user.id);
  }

  @Post(':id/like')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Toggle like on a photo' })
  @ApiResponse({ status: 200, description: 'Like toggled successfully' })
  toggleLike(@Param('id') id: string, @Request() req) {
    return this.photosService.toggleLike(id, req.user.id);
  }
}
