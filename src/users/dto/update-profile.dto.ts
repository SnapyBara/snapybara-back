import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, IsIn, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ 
    description: 'Username (3-20 characters, alphanumeric and underscore only)',
    example: 'john_doe123',
    required: false 
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores'
  })
  username?: string;

  @ApiProperty({ 
    description: 'Profile picture URL',
    example: 'https://example.com/avatar.jpg',
    required: false 
  })
  @IsOptional()
  @IsUrl()
  profilePicture?: string;

  @ApiProperty({ 
    description: 'User language preference',
    example: 'fr',
    enum: ['fr', 'en', 'es', 'de'],
    required: false 
  })
  @IsOptional()
  @IsString()
  @IsIn(['fr', 'en', 'es', 'de'])
  language?: string;

  @ApiProperty({ 
    description: 'User bio or description',
    example: 'Photography enthusiast and nature lover',
    required: false 
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;
}
