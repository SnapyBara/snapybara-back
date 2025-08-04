import {
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  IsBoolean,
  Min,
  Max,
  IsString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { POICategory } from './create-point.dto';

export class SearchPointsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Radius in kilometers (max 50km for Google Places compatibility)' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50) // Limité à 50km pour être compatible avec Google Places API
  @Type(() => Number)
  radius?: number;

  @ApiPropertyOptional({ enum: POICategory, isArray: true })
  @IsOptional()
  @Transform(({ value }) => {
    // Si c'est déjà un array, le retourner tel quel
    if (Array.isArray(value)) {
      return value;
    }
    // Si c'est une chaîne avec des virgules, la diviser
    if (typeof value === 'string' && value.includes(',')) {
      return value.split(',').map(v => v.trim());
    }
    // Si c'est une chaîne simple, la mettre dans un array
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  @IsArray()
  @IsEnum(POICategory, { each: true })
  categories?: POICategory[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  minRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  hasPhotos?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    // Si c'est déjà un array, le retourner tel quel
    if (Array.isArray(value)) {
      return value;
    }
    // Si c'est une chaîne avec des virgules, la diviser
    if (typeof value === 'string' && value.includes(',')) {
      return value.split(',').map(v => v.trim());
    }
    // Si c'est une chaîne simple, la mettre dans un array
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['distance', 'rating', 'recent', 'popular'] })
  @IsOptional()
  @IsEnum(['distance', 'rating', 'recent', 'popular'])
  sortBy?: string = 'distance';

  @ApiPropertyOptional({ 
    description: 'Include Google Places results in the search',
    default: false 
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeGooglePlaces?: boolean;
}
