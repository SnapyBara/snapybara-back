import { IsString, IsNumber, IsOptional, IsObject, IsArray, IsBoolean, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
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
  OTHER = 'other'
}

class AddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  formattedAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;
}

class MetadataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  googlePlaceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  photos?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  googleTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priceLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  osmId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  osmTags?: Record<string, string>;
}

export class CreatePointDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  latitude: number;

  @ApiProperty()
  @IsNumber()
  longitude: number;

  @ApiProperty()
  @IsString()
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}

// Alias pour la compatibilité avec l'ancien nom
export class CreatePointOfInterestDto extends CreatePointDto {}
