import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleSignInDto {
  @ApiProperty({
    description: 'Google ID token obtained from Google Sign-In',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjdlM...',
  })
  @IsNotEmpty({ message: 'Google ID token is required' })
  @IsString({ message: 'Google ID token must be a string' })
  idToken: string;
}
