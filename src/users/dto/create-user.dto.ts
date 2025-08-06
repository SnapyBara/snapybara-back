import { IsEmail, IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: "Email de l'utilisateur" })
  @IsEmail()
  email: string;

  @ApiProperty({ description: "ID Supabase de l'utilisateur" })
  @IsString()
  supabaseId: string;

  @ApiProperty({ description: "Nom d'utilisateur unique" })
  @IsString()
  username: string;

  @ApiProperty({ description: 'URL de la photo de profil', required: false })
  @IsOptional()
  @IsString()
  profilePicture?: string;

  @ApiProperty({ description: 'Notifications activées', required: false })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @ApiProperty({ description: 'Mode sombre activé', required: false })
  @IsOptional()
  @IsBoolean()
  darkModeEnabled?: boolean;

  @ApiProperty({
    description: 'Paramètres de confidentialité',
    required: false,
  })
  @IsOptional()
  @IsString()
  privacySettings?: 'public' | 'friends' | 'private';

  @ApiProperty({ description: 'Langue préférée', required: false })
  @IsOptional()
  @IsString()
  language?: string;
}
