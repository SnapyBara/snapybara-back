import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class ImportGooglePlacesDto {
  @ApiProperty({
    description: 'Latitude du centre de recherche',
    example: 48.8566,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: 'Longitude du centre de recherche',
    example: 2.3522,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({
    description: 'Rayon de recherche en kilomètres',
    example: 5,
    minimum: 0.1,
    maximum: 50,
    required: false,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  radiusKm?: number = 5;

  @ApiProperty({
    description: 'Nombre maximum de lieux à importer',
    example: 50,
    minimum: 1,
    maximum: 200,
    required: false,
    default: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  maxPlaces?: number = 50;
}
