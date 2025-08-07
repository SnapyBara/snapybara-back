import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

export class UserResponseDto {
  @ApiProperty()
  @Expose()
  _id: string;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty()
  @Expose()
  username: string;

  @ApiProperty()
  @Expose()
  profilePicture?: string;

  @ApiProperty()
  @Expose()
  level: number;

  @ApiProperty()
  @Expose()
  points: number;

  @ApiProperty()
  @Expose()
  achievements: string[];

  @ApiProperty()
  @Expose()
  notificationsEnabled: boolean;

  @ApiProperty()
  @Expose()
  darkModeEnabled: boolean;

  @ApiProperty()
  @Expose()
  privacySettings: string;

  @ApiProperty()
  @Expose()
  language: string;

  @ApiProperty({
    description: 'User role',
    enum: ['user', 'moderator', 'admin'],
  })
  @Expose()
  role: string;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  isEmailVerified: boolean;

  @ApiProperty()
  @Expose()
  photosUploaded: number;

  @ApiProperty()
  @Expose()
  pointsOfInterestCreated: number;

  @ApiProperty()
  @Expose()
  commentsWritten: number;

  @ApiProperty()
  @Expose()
  likesReceived: number;

  @ApiProperty()
  @Expose()
  dateJoined: Date;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty()
  @Expose()
  lastLoginAt?: Date;

  // On exclut l'ID Supabase pour la sécurité
  @Exclude()
  supabaseId: string;

  @Exclude()
  metadata: Record<string, any>;
}
