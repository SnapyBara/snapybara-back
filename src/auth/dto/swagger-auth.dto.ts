import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({
    description: 'Unique identifier for the user',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    required: false,
  })
  full_name?: string;

  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatar_url?: string;

  @ApiProperty({
    description: 'Whether the user email is verified',
    example: true,
  })
  email_verified: boolean;

  @ApiProperty({
    description: 'Authentication provider used',
    example: 'google',
    enum: ['email', 'google'],
  })
  provider: string;

  @ApiProperty({
    description: 'User creation timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'User last update timestamp',
    example: '2025-01-01T00:00:00.000Z',
    required: false,
  })
  updated_at?: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'Operation success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'User profile data',
    type: UserProfileDto,
  })
  data: UserProfileDto;
}

export class CurrentUserDto {
  @ApiProperty({
    description: 'Unique identifier for the user',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    required: false,
  })
  full_name?: string;

  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatar_url?: string;

  @ApiProperty({
    description: 'Authentication status',
    example: true,
  })
  authenticated: boolean;
}

export class CurrentUserResponseDto {
  @ApiProperty({
    description: 'Operation success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Current user data',
    type: CurrentUserDto,
  })
  data: CurrentUserDto;
}

export class StatusResponseDto {
  @ApiProperty({
    description: 'Service status',
    example: 'OK',
  })
  status: string;

  @ApiProperty({
    description: 'Service description',
    example: 'SnapyBara Auth service is running',
  })
  message: string;

  @ApiProperty({
    description: 'Authentication method used',
    example: 'Supabase JWT verification',
  })
  authentication: string;

  @ApiProperty({
    description: 'Available endpoints',
    example: {
      profile: 'GET /auth/profile (protected)',
      me: 'GET /auth/me (protected)',
      status: 'GET /auth/status (public)',
    },
  })
  endpoints: Record<string, string>;

  @ApiProperty({
    description: 'Response timestamp',
    example: '2025-07-10T15:30:00.000Z',
  })
  timestamp: string;
}

export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 401,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Authentication failed',
  })
  message: string;

  @ApiProperty({
    description: 'Error type',
    example: 'Unauthorized',
  })
  error: string;
}
