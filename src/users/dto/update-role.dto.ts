import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
}

export class UpdateRoleDto {
  @ApiProperty({
    description: 'The role to assign to the user',
    enum: UserRole,
    example: UserRole.MODERATOR,
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}
