import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class EnrichSinglePOIDto {
  @ApiProperty({ description: 'POI ID (OSM format: node-123456)' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'POI name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Latitude' })
  @IsNumber()
  lat: number;

  @ApiProperty({ description: 'Longitude' })
  @IsNumber()
  lon: number;

  @ApiProperty({ description: 'POI type/category' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'OSM tags', required: false })
  @IsObject()
  @IsOptional()
  tags?: Record<string, string>;
}

export class POIPhotoResult {
  @ApiProperty({ description: 'Photo URL' })
  url: string;

  @ApiProperty({
    description: 'Photo source',
    enum: ['wikimedia', 'unsplash', 'placeholder'],
  })
  source: 'wikimedia' | 'unsplash' | 'placeholder';

  @ApiProperty({ description: 'Attribution text' })
  attribution?: string;

  @ApiProperty({ description: 'Photo width' })
  width?: number;

  @ApiProperty({ description: 'Photo height' })
  height?: number;
}

export class EnrichPOIResponse {
  @ApiProperty({ description: 'POI ID' })
  id: string;

  @ApiProperty({ description: 'Array of photos', type: [POIPhotoResult] })
  photos: POIPhotoResult[];

  @ApiProperty({ description: 'Search terms used for photo search' })
  photoSearchTerms?: string[];

  @ApiProperty({ description: 'Whether photos were found' })
  hasPhotos: boolean;

  @ApiProperty({ description: 'Time taken to fetch photos in ms' })
  fetchTime: number;
}
