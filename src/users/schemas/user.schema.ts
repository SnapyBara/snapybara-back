import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  collection: 'users',
})
export class User {
  _id?: Types.ObjectId;

  // ===== IDENTIFIANTS ET CONNEXION SUPABASE =====
  @Prop({ required: true, unique: true })
  supabaseId: string; // Lien avec Supabase

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  username: string;

  // ===== PROFIL UTILISATEUR =====
  @Prop({ required: false })
  profilePicture?: string;

  @Prop({ default: Date.now })
  dateJoined: Date;

  // ===== GAMIFICATION (selon ton schéma) =====
  @Prop({ default: 1 })
  level: number; // Niveau utilisateur

  @Prop({ default: 0 })
  points: number; // Points accumulés

  // ===== BADGES ET ACHIEVEMENTS =====
  @Prop({ type: [String], default: [] })
  achievements: string[]; // IDs des achievements obtenus

  // ===== PRÉFÉRENCES UTILISATEUR =====
  @Prop({ default: true })
  notificationsEnabled: boolean;

  @Prop({ default: false })
  darkModeEnabled: boolean;

  @Prop({ default: 'public' })
  privacySettings: 'public' | 'friends' | 'private';

  @Prop({ default: 'fr' })
  language: string;

  // ===== STATUTS ET MÉTADONNÉES =====
  @Prop({ default: 'user', enum: ['user', 'admin', 'moderator'] })
  role: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ required: false })
  lastLoginAt?: Date;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  // ===== STATISTIQUES (pour le profil) =====
  @Prop({ default: 0 })
  photosUploaded: number; // Nombre de photos uploadées

  @Prop({ default: 0 })
  pointsOfInterestCreated: number; // POI créés

  @Prop({ default: 0 })
  commentsWritten: number; // Commentaires écrits

  @Prop({ default: 0 })
  likesReceived: number; // Likes reçus sur ses photos

  // ===== MÉTADONNÉES SUPPLÉMENTAIRES =====
  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Index pour optimiser les requêtes
UserSchema.index({ email: 1 });
UserSchema.index({ supabaseId: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ points: -1 }); // Pour les classements
UserSchema.index({ level: -1 });
UserSchema.index({ createdAt: -1 });
