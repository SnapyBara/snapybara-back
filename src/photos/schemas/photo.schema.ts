import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PhotoDocument = Photo & Document;

@Schema({
  timestamps: true,
  collection: 'photos',
})
export class Photo {
  _id?: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'PointOfInterest' })
  pointId: Types.ObjectId;

  @Prop({ required: true })
  url: string;

  @Prop()
  thumbnailUrl?: string;

  @Prop()
  mediumUrl?: string;

  @Prop()
  largeUrl?: string;

  @Prop()
  filename?: string;

  @Prop()
  originalName?: string;

  @Prop()
  mimeType?: string;

  @Prop()
  caption?: string;

  @Prop({ default: true })
  isPublic: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({
    default: 'pending',
    enum: ['pending', 'approved', 'rejected', 'reported'],
  })
  status: string;

  @Prop({ default: 0 })
  likesCount: number;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  likedBy: Types.ObjectId[];

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: 0 })
  downloadCount: number;

  @Prop({ type: Object })
  metadata?: {
    camera?: string;
    lens?: string;
    focalLength?: string;
    aperture?: string;
    shutterSpeed?: string;
    iso?: number;
    capturedAt?: Date;
    weather?: string;
    width?: number;
    height?: number;
    size?: number;
    format?: string;
  };

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [String], default: [] })
  colorPalette: string[];

  @Prop({ type: Object })
  exifData?: Record<string, any>;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const PhotoSchema = SchemaFactory.createForClass(Photo);

// Indexes
PhotoSchema.index({ userId: 1, createdAt: -1 });
PhotoSchema.index({ pointId: 1, createdAt: -1 });
PhotoSchema.index({ isPublic: 1, status: 1, createdAt: -1 });
PhotoSchema.index({ likesCount: -1 });
PhotoSchema.index({ tags: 1 });
PhotoSchema.index({ likedBy: 1 });
