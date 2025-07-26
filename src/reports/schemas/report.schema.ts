import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReportDocument = Report & Document;

@Schema({
  timestamps: true,
  collection: 'reports',
})
export class Report {
  _id?: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  reporterId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['point', 'photo', 'review', 'user', 'collection'],
  })
  reportedType: string;

  @Prop({ required: true })
  reportedId: string;

  @Prop({
    required: true,
    enum: [
      'inappropriate_content',
      'spam',
      'copyright',
      'wrong_location',
      'fake_information',
      'harassment',
      'violence',
      'hate_speech',
      'privacy_violation',
      'other',
    ],
  })
  reason: string;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  evidenceUrls: string[];

  @Prop({
    default: 'pending',
    enum: ['pending', 'under_review', 'resolved', 'dismissed'],
  })
  status: string;

  @Prop()
  priority?: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop()
  resolution?: string;

  @Prop({ type: Object })
  actions?: {
    contentRemoved?: boolean;
    userWarned?: boolean;
    userSuspended?: boolean;
    userBanned?: boolean;
    other?: string;
  };

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// Indexes
ReportSchema.index({ reporterId: 1 });
ReportSchema.index({ reportedType: 1, reportedId: 1 });
ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ assignedTo: 1, status: 1 });
ReportSchema.index({ reason: 1 });
ReportSchema.index({ priority: -1, createdAt: -1 });
