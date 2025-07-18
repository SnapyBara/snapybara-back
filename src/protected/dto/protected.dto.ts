import { ApiProperty } from '@nestjs/swagger';

export class ActivityDto {
  @ApiProperty({
    description: 'Activity type',
    example: 'check-in',
    enum: ['check-in', 'photo', 'review', 'visit'],
  })
  type: string;

  @ApiProperty({
    description: 'Location where activity occurred',
    example: 'Paris',
  })
  location: string;

  @ApiProperty({
    description: 'Points earned from activity',
    example: 10,
  })
  points: number;
}

export class DashboardDataDto {
  @ApiProperty({
    description: 'Total points earned by user',
    example: 150,
  })
  total_points: number;

  @ApiProperty({
    description: 'Recent user activities',
    type: [ActivityDto],
  })
  recent_activities: ActivityDto[];
}

export class DashboardContentDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  user_id: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  user_email: string;

  @ApiProperty({
    description: 'Dashboard specific data',
    type: DashboardDataDto,
  })
  dashboard_data: DashboardDataDto;
}

export class DashboardResponseDto {
  @ApiProperty({
    description: 'Operation success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Welcome message',
    example: 'Welcome John Doe!',
  })
  message: string;

  @ApiProperty({
    description: 'Dashboard data',
    type: DashboardContentDto,
  })
  data: DashboardContentDto;
}

export class FavoriteDto {
  @ApiProperty({
    description: 'Favorite item ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Favorite item name',
    example: 'Tour Eiffel',
  })
  name: string;

  @ApiProperty({
    description: 'Favorite item category',
    example: 'monument',
    enum: ['monument', 'museum', 'restaurant', 'park', 'other'],
  })
  category: string;
}

export class FavoritesResponseDto {
  @ApiProperty({
    description: 'Operation success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'User unique identifier',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  user_id: string;

  @ApiProperty({
    description: 'User favorite items',
    type: [FavoriteDto],
  })
  favorites: FavoriteDto[];
}

export class SettingsDto {
  @ApiProperty({
    description: 'Enable notifications',
    example: true,
  })
  notifications: boolean;

  @ApiProperty({
    description: 'Enable location sharing',
    example: false,
  })
  location_sharing: boolean;

  @ApiProperty({
    description: 'App theme preference',
    example: 'dark',
    enum: ['light', 'dark', 'auto'],
  })
  theme: string;

  @ApiProperty({
    description: 'Language preference',
    example: 'fr',
    enum: ['en', 'fr', 'es', 'de'],
  })
  language: string;
}

export class SettingsResponseDto {
  @ApiProperty({
    description: 'Operation success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'User unique identifier',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  user_id: string;

  @ApiProperty({
    description: 'User settings',
    type: SettingsDto,
  })
  settings: SettingsDto;
}
