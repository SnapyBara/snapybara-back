import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SearchStrategy {
  TILES = 'tiles',
  CLUSTERS = 'clusters',
  DIRECT = 'direct',
  HYBRID = 'hybrid',
}

export enum SearchPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

export class SearchOptionsDto {
  @ApiProperty({ required: true, description: 'Latitude' })
  @IsNumber()
  @Type(() => Number)
  lat: number;

  @ApiProperty({ required: true, description: 'Longitude' })
  @IsNumber()
  @Type(() => Number)
  lon: number;

  @ApiProperty({
    required: false,
    default: 5,
    description: 'Search radius in kilometers',
  })
  @IsNumber()
  @Min(0.1)
  @Max(500)
  @IsOptional()
  @Type(() => Number)
  radius?: number = 5;

  @ApiProperty({
    required: false,
    description: 'Return clusters instead of individual POIs',
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  returnClusters?: boolean;

  @ApiProperty({
    required: false,
    enum: SearchStrategy,
    description: 'Force specific search strategy',
  })
  @IsEnum(SearchStrategy)
  @IsOptional()
  strategy?: SearchStrategy;

  @ApiProperty({
    required: false,
    enum: SearchPriority,
    description: 'Query priority',
  })
  @IsEnum(SearchPriority)
  @IsOptional()
  priority?: SearchPriority;

  @ApiProperty({ required: false, description: 'Maximum number of results' })
  @IsNumber()
  @Min(1)
  @Max(500)
  @IsOptional()
  @Type(() => Number)
  maxResults?: number;

  @ApiProperty({
    required: false,
    description: 'POI categories to filter',
    isArray: true,
  })
  @IsArray()
  @IsOptional()
  categories?: string[];
}
