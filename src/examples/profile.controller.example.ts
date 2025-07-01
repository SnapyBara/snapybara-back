import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/guards/auth.guard';
import { CurrentUserRest } from '../common/decorators/current-user.decorator';
import { SupabaseService } from '../supabase/supabase.service';
import { UserProfile, UserPreferences } from '../types/user.types';
import {
  extractUserInfo,
  getDefaultUserPreferences,
} from '../common/helpers/auth.helpers';

/**
 * EXEMPLE : Contrôleur de gestion des profils utilisateur
 * Montre comment utiliser l'authentification Supabase dans vos propres contrôleurs
 */

@ApiTags('profile')
@Controller('profile')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ProfileController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get()
  @ApiOperation({ summary: "Récupérer le profil de l'utilisateur connecté" })
  @ApiResponse({
    status: 200,
    description: 'Profil utilisateur récupéré avec succès',
    schema: {
      example: {
        id: 'uuid',
        email: 'user@example.com',
        first_name: 'Jean',
        last_name: 'Dupont',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Photographe passionné',
        preferences: {
          language: 'fr',
          notifications: { email_notifications: true },
        },
      },
    },
  })
  async getProfile(@CurrentUserRest() user: User): Promise<UserProfile> {
    // Récupération du profil depuis la base de données
    const { data: profile, error } = await this.supabaseService.client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new BadRequestException('Erreur lors de la récupération du profil');
    }

    if (!profile) {
      const basicInfo = extractUserInfo(user);
      const newProfile = {
        ...basicInfo,
        preferences: getDefaultUserPreferences(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: createdProfile, error: createError } =
        await this.supabaseService.client
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();

      if (createError) {
        throw new BadRequestException('Erreur lors de la création du profil');
      }

      return createdProfile as UserProfile;
    }

    return profile as UserProfile;
  }

  @Put()
  @ApiOperation({ summary: 'Mettre à jour le profil utilisateur' })
  @ApiResponse({ status: 200, description: 'Profil mis à jour avec succès' })
  async updateProfile(
    @CurrentUserRest() user: User,
    @Body() updateData: Partial<UserProfile>,
  ): Promise<UserProfile> {
    const {
      id: _id,
      email: _email,
      created_at: _created_at,
      ...allowedUpdates
    } = updateData;

    const updates = {
      ...allowedUpdates,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProfile, error } = await this.supabaseService.client
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Erreur lors de la mise à jour du profil');
    }

    return updatedProfile as UserProfile;
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Mettre à jour les préférences utilisateur' })
  async updatePreferences(
    @CurrentUserRest() user: User,
    @Body() preferences: Partial<UserPreferences>,
  ): Promise<UserProfile> {
    const { data: currentProfile } = await this.supabaseService.client
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single();

    const updatedPreferences = {
      ...(currentProfile?.preferences as UserPreferences),
      ...preferences,
    };

    const { data: updatedProfile, error } = await this.supabaseService.client
      .from('profiles')
      .update({
        preferences: updatedPreferences,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        'Erreur lors de la mise à jour des préférences',
      );
    }

    return updatedProfile as UserProfile;
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Uploader un avatar utilisateur' })
  async uploadAvatar(
    @CurrentUserRest() user: User,
    @Body('avatar_url') avatarUrl: string,
  ): Promise<{ avatar_url: string }> {
    const { data: updatedProfile, error } = await this.supabaseService.client
      .from('profiles')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('avatar_url')
      .single();

    if (error) {
      throw new BadRequestException(
        "Erreur lors de la mise à jour de l'avatar",
      );
    }

    return { avatar_url: updatedProfile.avatar_url as string };
  }

  @Get('stats')
  @ApiOperation({ summary: "Récupérer les statistiques de l'utilisateur" })
  async getUserStats(@CurrentUserRest() user: User) {
    // Exemple de requête complexe avec jointures
    const [photosCount, reviewsCount, pointsCount] = await Promise.all([
      this.supabaseService.client
        .from('photos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),

      this.supabaseService.client
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),

      this.supabaseService.client
        .from('points_of_interest')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

    return {
      total_photos: photosCount.count ?? 0,
      total_reviews: reviewsCount.count ?? 0,
      total_points: pointsCount.count ?? 0,
      user_since: user.created_at,
    };
  }

  @Delete()
  @ApiOperation({ summary: 'Supprimer le compte utilisateur' })
  @ApiResponse({ status: 200, description: 'Compte supprimé avec succès' })
  async deleteAccount(
    @CurrentUserRest() user: User,
  ): Promise<{ message: string }> {
    // Suppression en cascade gérée par les policies RLS
    const { error } = await this.supabaseService.client
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (error) {
      throw new BadRequestException('Erreur lors de la suppression du compte');
    }

    // Optionnel : Supprimer l'utilisateur de l'auth Supabase
    // (nécessite les droits admin)

    return { message: 'Compte supprimé avec succès' };
  }

  @Get('complete-check')
  @ApiOperation({ summary: 'Vérifier si le profil est complet' })
  async checkProfileCompletion(@CurrentUserRest() user: User): Promise<{
    is_complete: boolean;
    missing_fields: string[];
    completion_percentage: number;
  }> {
    const { data: profile } = await this.supabaseService.client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return {
        is_complete: false,
        missing_fields: ['first_name', 'last_name'],
        completion_percentage: 0,
      };
    }

    const requiredFields = ['first_name', 'last_name', 'bio'];
    const optionalFields = ['phone', 'avatar_url'];

    const missingRequired = requiredFields.filter((field) => {
      const value = profile[field];
      return !value || (typeof value === 'string' && value.trim() === '');
    });

    const filledOptional = optionalFields.filter((field) => {
      const value = profile[field];
      return value && typeof value === 'string' && value.trim() !== '';
    });

    const totalFields = requiredFields.length + optionalFields.length;
    const filledFields =
      requiredFields.length - missingRequired.length + filledOptional.length;
    const completionPercentage = Math.round((filledFields / totalFields) * 100);

    return {
      is_complete: missingRequired.length === 0,
      missing_fields: missingRequired,
      completion_percentage: completionPercentage,
    };
  }
}
