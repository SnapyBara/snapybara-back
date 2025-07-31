import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AutocompleteQueryDto {
  @ApiProperty({
    description: 'The text string on which to search',
    example: 'Paris',
  })
  @IsString()
  input: string;

  @ApiProperty({
    description: 'The latitude around which to retrieve place information',
    example: 48.8566,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiProperty({
    description: 'The longitude around which to retrieve place information',
    example: 2.3522,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiProperty({
    description: 'The distance (in meters) within which to return place results',
    example: 50000,
    required: false,
    minimum: 1,
    maximum: 50000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50000)
  radius?: number;
}

export class AutocompletePrediction {
  @ApiProperty({
    description: 'Unique identifier for this prediction',
    example: 'ChIJD7fiBh9u5kcRYJSMaMOCCwQ',
  })
  placeId: string;

  @ApiProperty({
    description: 'Human-readable name for the returned result',
    example: 'Paris, France',
  })
  description: string;

  @ApiProperty({
    description: 'The main text of a prediction, usually the name of the place',
    example: 'Paris',
  })
  mainText: string;

  @ApiProperty({
    description: 'The secondary text of a prediction, usually the location',
    example: 'France',
  })
  secondaryText: string;

  @ApiProperty({
    description: 'Array of types that apply to this place',
    example: ['locality', 'political', 'geocode'],
  })
  types: string[];

  @ApiProperty({
    description: 'Distance from the specified location in meters',
    example: 15000,
    required: false,
  })
  distanceMeters?: number;
}

export class AutocompleteResponseDto {
  @ApiProperty({
    description: 'Array of predictions',
    type: [AutocompletePrediction],
  })
  predictions: AutocompletePrediction[];

  @ApiProperty({
    description: 'Status of the request',
    example: 'OK',
  })
  status: string;
}