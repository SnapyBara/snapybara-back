import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CollectionDocument = Collection & Document;

@Schema({
  timestamps: true,
  collection: 'collections',
})
export class Collection {
  _id?: Types.ObjectId;

  @Prop({ required: true, type: String }) // UUID de Supabase
  userId: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ default: true })
  isPublic: boolean;

  @Prop({ default: false })
  isDefault?: boolean;

  @Prop()
  coverPhotoUrl?: string;

  @Prop({ type: [Types.ObjectId], ref: 'PointOfInterest', default: [] })
  points: Types.ObjectId[];

  @Prop({ default: 0 })
  pointsCount: number;

  @Prop({ type: [String], default: [] }) // UUIDs de Supabase
  followers: string[];

  @Prop({ default: 0 })
  followersCount: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Object })
  settings?: {
    allowComments?: boolean;
    allowContributions?: boolean;
    requireApproval?: boolean;
  };

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const CollectionSchema = SchemaFactory.createForClass(Collection);

// Indexes
CollectionSchema.index({ userId: 1, createdAt: -1 });
CollectionSchema.index({ isPublic: 1, isActive: 1 });
CollectionSchema.index({ name: 'text', description: 'text' });
CollectionSchema.index({ tags: 1 });
CollectionSchema.index({ followersCount: -1 });
CollectionSchema.index({ points: 1 });
