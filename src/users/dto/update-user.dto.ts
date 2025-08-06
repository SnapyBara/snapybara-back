import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import {
  IsOptional,
  IsNumber,
  IsArray,
  IsString,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({ description: "Points de l'utilisateur", required: false })
  @IsOptional()
  @IsNumber()
  points?: number;

  @ApiProperty({ description: "Niveau de l'utilisateur", required: false })
  @IsOptional()
  @IsNumber()
  level?: number;

  @ApiProperty({
    description: "Achievements de l'utilisateur",
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  achievements?: string[];

  @ApiProperty({ description: 'Nombre de photos uploadées', required: false })
  @IsOptional()
  @IsNumber()
  photosUploaded?: number;

  @ApiProperty({ description: 'Nombre de POI créés', required: false })
  @IsOptional()
  @IsNumber()
  pointsOfInterestCreated?: number;

  @ApiProperty({
    description: 'Nombre de commentaires écrits',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  commentsWritten?: number;

  @ApiProperty({ description: 'Nombre de likes reçus', required: false })
  @IsOptional()
  @IsNumber()
  likesReceived?: number;

  @ApiProperty({ description: 'Utilisateur actif', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: 'Email vérifié', required: false })
  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;

  @ApiProperty({ description: 'Métadonnées supplémentaires', required: false })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Dernière connexion', required: false })
  @IsOptional()
  lastLoginAt?: Date;
}
