// Types principaux pour l'application SnapyBara
import { UserProfile } from './user.types';

// Point d'intérêt
export interface PointOfInterest {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  category: POICategory;
  is_public: boolean;
  created_at: string;
  updated_at: string;

  // Relations
  photos?: Photo[];
  reviews?: Review[];
  creator?: UserProfile;

  // Computed fields
  average_rating?: number;
  total_reviews?: number;
  total_photos?: number;
  distance?: number; // Distance depuis la position de l'utilisateur
}

// Catégories de points d'intérêt
export type POICategory =
  | 'landscape'
  | 'architecture'
  | 'street_art'
  | 'wildlife'
  | 'sunset'
  | 'waterfall'
  | 'beach'
  | 'mountain'
  | 'forest'
  | 'urban'
  | 'historical'
  | 'religious'
  | 'other';

// Photo
export interface Photo {
  id: string;
  user_id: string;
  point_id: string;
  url: string;
  thumbnail_url?: string;
  caption?: string;
  is_public: boolean;
  metadata?: PhotoMetadata;
  created_at: string;

  // Relations
  point?: PointOfInterest;
  photographer?: UserProfile;

  // Computed
  likes_count?: number;
  is_liked?: boolean;
}

// Métadonnées photo
export interface PhotoMetadata {
  camera?: string;
  lens?: string;
  focal_length?: string;
  aperture?: string;
  shutter_speed?: string;
  iso?: number;
  captured_at?: string;
  weather?: string;
  tags?: string[];
  color_palette?: string[];
}

// Avis/Review
export interface Review {
  id: string;
  user_id: string;
  point_id: string;
  rating: number; // 1-5
  comment?: string;
  pros?: string[];
  cons?: string[];
  best_time?:
    | 'morning'
    | 'afternoon'
    | 'evening'
    | 'night'
    | 'golden_hour'
    | 'blue_hour';
  difficulty?: 'easy' | 'moderate' | 'hard';
  crowd_level?: 'empty' | 'quiet' | 'moderate' | 'busy' | 'crowded';
  created_at: string;
  updated_at: string;

  // Relations
  reviewer?: UserProfile;
  point?: PointOfInterest;

  // Computed
  helpful_count?: number;
  is_helpful?: boolean;
}

// Recherche et filtres
export interface SearchFilters {
  category?: POICategory[];
  rating_min?: number;
  distance_max?: number; // en km
  difficulty?: ('easy' | 'moderate' | 'hard')[];
  has_photos?: boolean;
  is_public?: boolean;
  crowd_level?: ('empty' | 'quiet' | 'moderate' | 'busy' | 'crowded')[];
  best_time?: (
    | 'morning'
    | 'afternoon'
    | 'evening'
    | 'night'
    | 'golden_hour'
    | 'blue_hour'
  )[];
}

// Géolocalisation
export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

// Zone géographique
export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Résultat de recherche avec pagination
export interface SearchResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// Notification
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export type NotificationType =
  | 'new_photo_nearby'
  | 'review_on_point'
  | 'achievement_earned'
  | 'friend_request'
  | 'weekly_digest'
  | 'point_approved'
  | 'photo_liked';

// Collection/Liste de favoris
export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_public: boolean;
  cover_photo_url?: string;
  created_at: string;
  updated_at: string;

  // Relations
  points?: PointOfInterest[];
  creator?: UserProfile;

  // Computed
  points_count?: number;
}

// Rapport/Signalement
export interface Report {
  id: string;
  reporter_id: string;
  reported_type: 'point' | 'photo' | 'review' | 'user';
  reported_id: string;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
}

export type ReportReason =
  | 'inappropriate_content'
  | 'spam'
  | 'copyright'
  | 'wrong_location'
  | 'fake_information'
  | 'harassment'
  | 'other';

export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// Upload de fichier
export interface FileUpload {
  file: any; // Type simplifié pour éviter les erreurs Express.Multer
  destination: 'photos' | 'avatars' | 'thumbnails';
  compress?: boolean;
  resize?: {
    width: number;
    height: number;
  };
}

export interface UploadResult {
  url: string;
  path: string;
  size: number;
  mimetype: string;
  thumbnail_url?: string;
}
