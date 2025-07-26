import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  Min,
  Max,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum POICategory {
  LANDSCAPE = 'landscape',
  ARCHITECTURE = 'architecture',
  STREET_ART = 'street_art',
  WILDLIFE = 'wildlife',
  SUNSET = 'sunset',
  WATERFALL = 'waterfall',
  BEACH = 'beach',
  MOUNTAIN = 'mountain',
  FOREST = 'forest',
  URBAN = 'urban',
  HISTORICAL = 'historical',
  RELIGIOUS = 'religious',
  OTHER = 'other',
}

export class CreatePointOfInterestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(0, 1000)
  description?: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({ enum: POICategory })
  @IsEnum(POICategory)
  @IsNotEmpty()
  category: POICategory;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    formattedAddress?: string;
  };

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
