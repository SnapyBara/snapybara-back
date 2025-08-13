import { User } from '@supabase/supabase-js';
import { UserProfile } from '../../types/user.types';

/**
 * Extract for userE
 */
export function extractUserInfo(user: User): Partial<UserProfile> {
  return {
    id: user.id,
    email: user.email ?? '',
    first_name: (user.user_metadata?.first_name as string) ?? '',
    last_name: (user.user_metadata?.last_name as string) ?? '',
    avatar_url: (user.user_metadata?.avatar_url as string) ?? '',
    phone: user.phone ?? '',
  };
}

/**
 * Generate a display name for a user
 */
export function generateDisplayName(user: UserProfile | User): string {
  if ('first_name' in user && user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }

  if ('user_metadata' in user) {
    const { first_name, last_name } = user.user_metadata ?? {};
    if (first_name && last_name) {
      return `${first_name as string} ${last_name as string}`;
    }
    if (first_name) return first_name as string;
  }

  return user.email?.split('@')[0] ?? 'Utilisateur';
}

/**
 * Verify if a user profile is complete
 */
export function isProfileComplete(profile: UserProfile): boolean {
  const requiredFields = ['first_name', 'last_name'] as const;
  return requiredFields.every((field) => {
    const value = profile[field];
    return typeof value === 'string' && value.trim() !== '';
  });
}

/**
 * Génère des préférences par défaut pour un nouvel utilisateur
 */
export function getDefaultUserPreferences() {
  return {
    language: 'fr' as const,
    units: 'metric' as const,
    map_style: 'standard' as const,
    default_radius: 10,
    notifications: {
      email_notifications: true,
      push_notifications: true,
      new_photos_nearby: true,
      weekly_digest: true,
      friend_activity: true,
      achievements: true,
    },
    privacy: {
      profile_visibility: 'public' as const,
      location_sharing: true,
      show_in_leaderboard: true,
      allow_friend_requests: true,
    },
  };
}

/**
 * Valide un email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valide un mot de passe selon les critères de sécurité
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Le mot de passe doit contenir au moins 8 caractères');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une majuscule');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une minuscule');
  }

  if (!/\d/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre');
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un caractère spécial');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Génère un nom d'utilisateur unique basé sur l'email
 */
export function generateUsername(email: string): string {
  const baseUsername = email.split('@')[0].toLowerCase();
  const cleanUsername = baseUsername.replace(/[^a-z0-9]/g, '');
  const randomSuffix = Math.floor(Math.random() * 1000);
  return `${cleanUsername}${randomSuffix}`;
}

/**
 * Masque partiellement un email pour l'affichage
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}*@${domain}`;
  }

  const maskedLocal =
    localPart[0] +
    '*'.repeat(localPart.length - 2) +
    localPart[localPart.length - 1];
  return `${maskedLocal}@${domain}`;
}

/**
 * Vérifie si un utilisateur est administrateur
 */
export function isAdmin(user: User): boolean {
  return (
    user.app_metadata?.role === 'admin' ||
    user.app_metadata?.claims_admin === true
  );
}

/**
 * Vérifie si un utilisateur est modérateur
 */
export function isModerator(user: User): boolean {
  return (
    isAdmin(user) ||
    user.app_metadata?.role === 'moderator' ||
    user.app_metadata?.claims_moderator === true
  );
}

/**
 * Calcule le niveau d'un utilisateur basé sur ses points
 */
export function calculateUserLevel(totalPoints: number): number {
  // Niveau basé sur une progression exponentielle
  // Niveau 1: 0-100 points, Niveau 2: 100-300 points, etc.
  if (totalPoints < 100) return 1;
  if (totalPoints < 300) return 2;
  if (totalPoints < 600) return 3;
  if (totalPoints < 1000) return 4;
  if (totalPoints < 1500) return 5;
  if (totalPoints < 2100) return 6;
  if (totalPoints < 2800) return 7;
  if (totalPoints < 3600) return 8;
  if (totalPoints < 4500) return 9;
  if (totalPoints < 5500) return 10;

  // Au-delà du niveau 10, progression linéaire
  return Math.floor(10 + (totalPoints - 5500) / 1000);
}

/**
 * Calcule les points nécessaires pour le prochain niveau
 */
export function getPointsForNextLevel(currentPoints: number): number {
  // Points requis pour chaque niveau
  const levelThresholds = [
    0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500,
  ];

  // Trouver le prochain seuil
  for (let i = 1; i < levelThresholds.length; i++) {
    if (currentPoints < levelThresholds[i]) {
      return levelThresholds[i] - currentPoints;
    }
  }

  // Pour les niveaux > 10
  const currentLevel = calculateUserLevel(currentPoints);
  const nextLevelThreshold = 5500 + (currentLevel - 9) * 1000;
  return nextLevelThreshold - currentPoints;
}

/**
 * Formate une durée en texte lisible
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}j`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}min`;
  return `${seconds}s`;
}

/**
 * Formate une date relative (il y a X temps)
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const targetDate = new Date(date);
  const diffInSeconds = Math.floor(
    (now.getTime() - targetDate.getTime()) / 1000,
  );

  if (diffInSeconds < 60) return "À l'instant";
  if (diffInSeconds < 3600)
    return `Il y a ${Math.floor(diffInSeconds / 60)}min`;
  if (diffInSeconds < 86400)
    return `Il y a ${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 2592000)
    return `Il y a ${Math.floor(diffInSeconds / 86400)}j`;
  if (diffInSeconds < 31536000)
    return `Il y a ${Math.floor(diffInSeconds / 2592000)} mois`;
  return `Il y a ${Math.floor(diffInSeconds / 31536000)} an${
    Math.floor(diffInSeconds / 31536000) > 1 ? 's' : ''
  }`;
}
