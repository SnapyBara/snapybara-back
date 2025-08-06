import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AchievementDocument = Achievement & Document;

@Schema({
  timestamps: true,
  collection: 'achievements',
})
export class Achievement {
  _id?: Types.ObjectId;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  icon: string;

  @Prop({ required: true })
  condition: string;

  @Prop({ required: true })
  points: number;

  @Prop({
    required: true,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common',
  })
  rarity: string;

  @Prop({
    required: true,
    enum: [
      'photos',
      'reviews',
      'exploration',
      'social',
      'contribution',
      'special',
    ],
  })
  category: string;

  @Prop({ type: Object, required: true })
  criteria: {
    type: string;
    target: number;
    timeframe?: string;
    extra?: Record<string, any>;
  };

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isSecret: boolean;

  @Prop({ default: 0 })
  earnedCount: number;

  @Prop({ type: Object })
  rewards?: {
    badge?: string;
    title?: string;
    perks?: string[];
  };

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const AchievementSchema = SchemaFactory.createForClass(Achievement);

// User Achievement tracking
@Schema({
  timestamps: true,
  collection: 'user_achievements',
})
export class UserAchievement {
  _id?: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Achievement' })
  achievementId: Types.ObjectId;

  @Prop({ required: true })
  earnedAt: Date;

  @Prop({ default: 0 })
  progress: number;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const UserAchievementSchema =
  SchemaFactory.createForClass(UserAchievement);

// Indexes
AchievementSchema.index({ code: 1 });
AchievementSchema.index({ category: 1 });
AchievementSchema.index({ rarity: 1 });
AchievementSchema.index({ isActive: 1 });

UserAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
UserAchievementSchema.index({ userId: 1, earnedAt: -1 });
UserAchievementSchema.index({ achievementId: 1 });
