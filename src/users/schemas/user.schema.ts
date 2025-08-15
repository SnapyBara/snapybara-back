import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  collection: 'users',
})
export class User {
  _id?: Types.ObjectId;

  @Prop({ required: true, unique: true })
  supabaseId: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  username: string;

  @Prop({ required: false })
  profilePicture?: string;

  @Prop({ default: Date.now })
  dateJoined: Date;

  @Prop({ default: 1 })
  level: number;

  @Prop({ default: 0 })
  points: number;

  @Prop({ type: [String], default: [] })
  achievements: string[];

  @Prop({ default: true })
  notificationsEnabled: boolean;

  @Prop({ default: false })
  darkModeEnabled: boolean;

  @Prop({ default: 'public' })
  privacySettings: 'public' | 'friends' | 'private';

  @Prop({ default: 'fr' })
  language: string;

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

  @Prop({ default: 0 })
  photosUploaded: number;

  @Prop({ default: 0 })
  pointsOfInterestCreated: number;

  @Prop({ default: 0 })
  commentsWritten: number;

  @Prop({ default: 0 })
  likesReceived: number;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ username: 1 });
UserSchema.index({ points: -1 });
UserSchema.index({ level: -1 });
UserSchema.index({ createdAt: -1 });
