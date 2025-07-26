import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PointOfInterestDocument = PointOfInterest & Document;

@Schema({
  timestamps: true,
  collection: 'points_of_interest',
})
export class PointOfInterest {
  _id?: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop({
    required: true,
    enum: [
      'landscape',
      'architecture',
      'street_art',
      'wildlife',
      'sunset',
      'waterfall',
      'beach',
      'mountain',
      'forest',
      'urban',
      'historical',
      'religious',
      'other',
    ],
  })
  category: string;

  @Prop({ default: true })
  isPublic: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 'pending', enum: ['pending', 'approved', 'rejected'] })
  status: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ type: Object })
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    formattedAddress?: string;
  };

  @Prop({ type: Object })
  statistics?: {
    averageRating: number;
    totalReviews: number;
    totalPhotos: number;
    totalLikes: number;
  };

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const PointOfInterestSchema =
  SchemaFactory.createForClass(PointOfInterest);

// Indexes
PointOfInterestSchema.index({ location: '2dsphere' });
PointOfInterestSchema.index({ userId: 1 });
PointOfInterestSchema.index({ category: 1 });
PointOfInterestSchema.index({ isPublic: 1, status: 1 });
PointOfInterestSchema.index({ createdAt: -1 });
PointOfInterestSchema.index({ 'statistics.averageRating': -1 });

// Virtual for location
PointOfInterestSchema.virtual('location').get(function() {
  return {
    type: 'Point',
    coordinates: [this.longitude, this.latitude],
  };
});
