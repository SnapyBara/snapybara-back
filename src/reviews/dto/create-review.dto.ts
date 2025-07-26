import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  IsMongoId,
  IsObject,
  Min,
  Max,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BestTime {
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
  EVENING = 'evening',
  NIGHT = 'night',
  GOLDEN_HOUR = 'golden_hour',
  BLUE_HOUR = 'blue_hour',
}

export enum Difficulty {
  EASY = 'easy',
  MODERATE = 'moderate',
  HARD = 'hard',
}

export enum CrowdLevel {
  EMPTY = 'empty',
  QUIET = 'quiet',
  MODERATE = 'moderate',
  BUSY = 'busy',
  CROWDED = 'crowded',
}

export class CreateReviewDto {
  @ApiProperty()
  @IsMongoId()
  @IsNotEmpty()
  pointId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(10, 2000)
  comment?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pros?: string[];

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  cons?: string[];

  @ApiPropertyOptional({ enum: BestTime })
  @IsEnum(BestTime)
  @IsOptional()
  bestTime?: BestTime;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsEnum(Difficulty)
  @IsOptional()
  difficulty?: Difficulty;

  @ApiPropertyOptional({ enum: CrowdLevel })
  @IsEnum(CrowdLevel)
  @IsOptional()
  crowdLevel?: CrowdLevel;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  visitDetails?: {
    visitDate?: Date;
    duration?: number;
    weather?: string;
    season?: string;
    accessibility?: string;
    parkingAvailable?: boolean;
    entranceFee?: number;
  };
}
