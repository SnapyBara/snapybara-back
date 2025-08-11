import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

class UserDto {
  @IsString()
  id: string;

  @IsString()
  email: string;

  @IsString()
  created_at: string;
}

class SessionDto {
  @IsString()
  access_token: string;

  @IsString()
  refresh_token: string;

  @IsNumber()
  expires_in: number;

  @IsString()
  token_type: string;
}

export class AuthResponseDto {
  @IsObject()
  @ValidateNested()
  @Type(() => UserDto)
  user: UserDto;

  @IsObject()
  @ValidateNested()
  @Type(() => SessionDto)
  session: SessionDto;
}
