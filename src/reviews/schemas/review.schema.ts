import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReviewDocument = Review & Document;

@Schema({
  timestamps: true,
  collection: 'reviews',
})
export class Review {
  _id?: Types.ObjectId;

  @Prop({ required: true, type: String }) // UUID de Supabase
  userId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'PointOfInterest' })
  pointId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop()
  comment?: string;

  @Prop({ type: [String], default: [] })
  pros: string[];

  @Prop({ type: [String], default: [] })
  cons: string[];

  @Prop({
    enum: [
      'morning',
      'afternoon',
      'evening',
      'night',
      'golden_hour',
      'blue_hour',
    ],
  })
  bestTime?: string;

  @Prop({ enum: ['easy', 'moderate', 'hard'] })
  difficulty?: string;

  @Prop({ enum: ['empty', 'quiet', 'moderate', 'busy', 'crowded'] })
  crowdLevel?: string;

  @Prop({ default: 0 })
  helpfulCount: number;

  @Prop({ type: [String], default: [] }) // UUIDs de Supabase
  helpfulBy: string[];

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 'published', enum: ['published', 'hidden', 'reported'] })
  status: string;

  @Prop({ type: Object })
  visitDetails?: {
    visitDate?: Date;
    duration?: number; // in minutes
    weather?: string;
    season?: string;
    accessibility?: string;
    parkingAvailable?: boolean;
    entranceFee?: number;
  };

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Indexes
ReviewSchema.index({ userId: 1, pointId: 1 }, { unique: true });
ReviewSchema.index({ pointId: 1, createdAt: -1 });
ReviewSchema.index({ userId: 1, createdAt: -1 });
ReviewSchema.index({ rating: -1 });
ReviewSchema.index({ helpfulCount: -1 });
ReviewSchema.index({ isActive: 1, status: 1 });
