import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class EmailService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async sendEmailConfirmation(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .auth.signInWithOtp({
          email: email,
        });

      if (error) {
        console.error(
          "Erreur lors de l'envoi de l'email de confirmation:",
          error,
        );
        return {
          success: false,
          message: `Erreur lors de l'envoi: ${error.message}`,
        };
      }

      console.log('✅ Email de confirmation envoyé à:', email);
      console.log('📧 Utilisation du template email avec URL hardcodée');
      return {
        success: true,
        message: 'Email de confirmation envoyé avec succès',
      };
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi de l'email de confirmation:",
        error,
      );
      return {
        success: false,
        message: "Erreur interne lors de l'envoi de l'email",
      };
    }
  }

  async sendPasswordResetEmail(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .auth.resetPasswordForEmail(email, {
          redirectTo: `${process.env.BASE_API_URL}/email/reset-password`,
        });

      if (error) {
        console.error(
          "Erreur lors de l'envoi de l'email de reset password:",
          error,
        );
        return {
          success: false,
          message: `Erreur lors de l'envoi: ${error.message}`,
        };
      }

      console.log('✅ Email de reset password envoyé à:', email);
      return {
        success: true,
        message: 'Email de réinitialisation envoyé avec succès',
      };
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi de l'email de reset password:",
        error,
      );
      return {
        success: false,
        message: "Erreur interne lors de l'envoi de l'email",
      };
    }
  }

  async confirmEmailWithSupabase(tokenHash: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .auth.verifyOtp({
          token_hash: tokenHash,
          type: 'email',
        });

      if (error) {
        console.error('Erreur lors de la confirmation Supabase:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Erreur lors de la vérification OTP:', error);
      return false;
    }
  }

  async verifyPasswordResetToken(
    tokenHash: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });

      if (error) {
        console.error(
          'Erreur lors de la vérification du token de reset:',
          error,
        );
        return {
          success: false,
          message: `Token invalide: ${error.message}`,
        };
      }

      console.log('✅ Token de reset password valide pour:', data?.user?.email);
      return {
        success: true,
        message: 'Token de réinitialisation valide',
      };
    } catch (error) {
      console.error('Erreur lors de la vérification du token de reset:', error);
      return {
        success: false,
        message: 'Erreur lors de la vérification du token',
      };
    }
  }

  async verifyAccessToken(accessToken: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .auth.getUser(accessToken);

      if (error) {
        console.error('Erreur lors de la vérification du token:', error);
        return false;
      }

      console.log('Token valide pour:', data?.user?.email);
      return true;
    } catch (error) {
      console.error('Erreur lors de la vérification du token:', error);
      return false;
    }
  }
}
