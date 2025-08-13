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
  IsDateString,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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

export enum WeatherCondition {
  SUNNY = 'sunny',
  CLOUDY = 'cloudy',
  PARTLY_CLOUDY = 'partly_cloudy',
  RAINY = 'rainy',
  STORMY = 'stormy',
  SNOWY = 'snowy',
  FOGGY = 'foggy',
  WINDY = 'windy',
  CLEAR_NIGHT = 'clear_night',
  OTHER = 'other',
}

export enum TimeOfDay {
  SUNRISE = 'sunrise',
  MORNING = 'morning',
  MIDDAY = 'midday',
  AFTERNOON = 'afternoon',
  GOLDEN_HOUR = 'golden_hour',
  SUNSET = 'sunset',
  BLUE_HOUR = 'blue_hour',
  NIGHT = 'night',
}

export class PhotoMetadataDto {
  @ApiPropertyOptional({
    description: 'Camera model used',
    example: 'Canon EOS R5',
  })
  @IsString()
  @IsOptional()
  camera?: string;

  @ApiPropertyOptional({
    description: 'Lens model used',
    example: 'Canon RF 24-70mm f/2.8L IS USM',
  })
  @IsString()
  @IsOptional()
  lens?: string;

  @ApiPropertyOptional({
    description: 'Focal length used',
    example: '50mm',
  })
  @IsString()
  @IsOptional()
  focalLength?: string;

  @ApiPropertyOptional({
    description: 'Aperture setting',
    example: 'f/2.8',
  })
  @IsString()
  @IsOptional()
  aperture?: string;

  @ApiPropertyOptional({
    description: 'Shutter speed',
    example: '1/250s',
  })
  @IsString()
  @IsOptional()
  shutterSpeed?: string;

  @ApiPropertyOptional({
    description: 'ISO value',
    example: 400,
  })
  @IsNumber()
  @IsOptional()
  iso?: number;

  @ApiPropertyOptional({
    description: 'Date and time when the photo was taken',
    example: '2025-01-15T14:30:00Z',
  })
  @IsDateString()
  @IsOptional()
  capturedAt?: string;

  @ApiPropertyOptional({
    description: 'Weather condition when the photo was taken',
    enum: WeatherCondition,
    example: WeatherCondition.SUNNY,
  })
  @IsEnum(WeatherCondition)
  @IsOptional()
  weather?: WeatherCondition;

  @ApiPropertyOptional({
    description: 'Time of day when the photo was taken',
    enum: TimeOfDay,
    example: TimeOfDay.GOLDEN_HOUR,
  })
  @IsEnum(TimeOfDay)
  @IsOptional()
  timeOfDay?: TimeOfDay;
}

export class PhotoUploadDto {
  @ApiProperty({
    description: 'Base64 encoded image or URL to the photo',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
  })
  @IsString()
  @IsNotEmpty()
  imageData: string;

  @ApiPropertyOptional({
    description: 'Caption for the photo',
    example: 'Beautiful sunset at the Eiffel Tower',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @Length(0, 500)
  caption?: string;

  @ApiPropertyOptional({
    description: 'Metadata about the photo',
    type: PhotoMetadataDto,
  })
  @ValidateNested()
  @Type(() => PhotoMetadataDto)
  @IsOptional()
  metadata?: PhotoMetadataDto;

  @ApiPropertyOptional({
    description: 'Tags for the photo',
    example: ['sunset', 'eiffel-tower', 'paris', 'golden-hour'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class CreatePointWithPhotosDto {
  @ApiProperty({
    description: 'Name of the point of interest',
    example: 'Eiffel Tower - Trocadéro Gardens View',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the location',
    example:
      'Perfect spot for sunrise photos with clear view of the Eiffel Tower from Trocadéro Gardens',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @Length(0, 1000)
  description?: string;

  @ApiProperty({
    description: 'Latitude of the exact location',
    example: 48.8619,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: 'Longitude of the exact location',
    example: 2.2876,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({
    description: 'Category of the point of interest',
    enum: POICategory,
    example: POICategory.ARCHITECTURE,
  })
  @IsEnum(POICategory)
  @IsNotEmpty()
  category: POICategory;

  @ApiProperty({
    description: 'Photos to upload with the point',
    type: [PhotoUploadDto],
    minItems: 1,
    maxItems: 10,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoUploadDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  photos: PhotoUploadDto[];

  @ApiPropertyOptional({
    description: 'Google Place ID if this is from a Google location',
    example: 'ChIJLU7jZClu5kcR4PcOOO6p3I0',
  })
  @IsString()
  @IsOptional()
  googlePlaceId?: string;

  @ApiPropertyOptional({
    description: 'Tags for the location',
    example: ['tourist-spot', 'iconic', 'best-view', 'free-access'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Best time to visit',
    example: 'Early morning (6-8 AM) for best light and fewer tourists',
  })
  @IsString()
  @IsOptional()
  @Length(0, 500)
  bestTimeToVisit?: string;

  @ApiPropertyOptional({
    description: 'Accessibility information',
    example:
      'Wheelchair accessible. Public transport: Metro Line 6/9 Trocadéro station',
  })
  @IsString()
  @IsOptional()
  @Length(0, 500)
  accessibilityInfo?: string;

  @ApiPropertyOptional({
    description: 'Photography tips for this location',
    example:
      'Use wide-angle lens for full tower view. Tripod recommended for sunrise shots.',
  })
  @IsString()
  @IsOptional()
  @Length(0, 1000)
  photographyTips?: string;

  @ApiPropertyOptional({
    description: 'Is this location free to access?',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isFreeAccess?: boolean;

  @ApiPropertyOptional({
    description: 'Does this location require permission for photography?',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  requiresPermission?: boolean;

  @ApiPropertyOptional({
    description: 'Difficulty level to reach this spot',
    enum: ['easy', 'moderate', 'difficult', 'extreme'],
    example: 'easy',
  })
  @IsEnum(['easy', 'moderate', 'difficult', 'extreme'])
  @IsOptional()
  difficulty?: string;

  @ApiPropertyOptional({
    description: 'Address information',
    type: Object,
  })
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

  @ApiPropertyOptional({
    description: 'Should this point be public immediately after approval?',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: Object,
  })
  @IsObject()
  @IsOptional()
  metadata?: {
    parkingAvailable?: boolean;
    nearbyFacilities?: string[];
    safetyNotes?: string;
    crowdLevel?: 'low' | 'medium' | 'high' | 'varies';
    permitRequired?: boolean;
    entranceFee?: string;
    openingHours?: string;
    seasonalNotes?: string;
  };
}
