import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({
  timestamps: true,
  collection: 'notifications',
})
export class Notification {
  _id?: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    enum: [
      'new_photo_nearby',
      'review_on_point',
      'achievement_earned',
      'friend_request',
      'friend_request_accepted',
      'weekly_digest',
      'point_approved',
      'photo_liked',
      'new_follower',
      'mention',
      'comment_on_photo',
      'comment_on_review',
      'system',
    ],
  })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object })
  data?: {
    entityType?: string;
    entityId?: string;
    fromUserId?: string;
    imageUrl?: string;
    actionUrl?: string;
    extra?: Record<string, any>;
  };

  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  readAt?: Date;

  @Prop({ default: false })
  isDelivered: boolean;

  @Prop()
  deliveredAt?: Date;

  @Prop({ default: 'low', enum: ['low', 'medium', 'high', 'urgent'] })
  priority: string;

  @Prop()
  expiresAt?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, type: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
NotificationSchema.index({ createdAt: -1 });
