import { User } from '@supabase/supabase-js';

// Profile étendu pour SnapyBara
export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
  preferences: UserPreferences;
  created_at: string;
  updated_at: string;
}

// Préférences utilisateur
export interface UserPreferences {
  language?: 'fr' | 'en' | 'es';
  units?: 'metric' | 'imperial';
  notifications?: NotificationSettings;
  privacy?: PrivacySettings;
  map_style?: 'standard' | 'satellite' | 'terrain';
  default_radius?: number; // en km
}

// Paramètres de notification
export interface NotificationSettings {
  email_notifications?: boolean;
  push_notifications?: boolean;
  new_photos_nearby?: boolean;
  weekly_digest?: boolean;
  friend_activity?: boolean;
  achievements?: boolean;
}

// Paramètres de confidentialité
export interface PrivacySettings {
  profile_visibility?: 'public' | 'friends' | 'private';
  location_sharing?: boolean;
  show_in_leaderboard?: boolean;
  allow_friend_requests?: boolean;
}

// Utilisateur avec profil complet
export interface FullUser extends User {
  profile?: UserProfile;
}

// Statistiques utilisateur
export interface UserStats {
  total_photos: number;
  total_points: number;
  total_reviews: number;
  favorite_spots: number;
  friends_count: number;
  badges_earned: string[];
  level: number;
  rank: number;
}

// Achievement/Badge
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: string;
  points: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earned_at?: string;
}

// Réponse d'authentification enrichie
export interface AuthResponse {
  user: FullUser | null;
  session: any;
  profile?: UserProfile;
  stats?: UserStats;
  achievements?: Achievement[];
}
