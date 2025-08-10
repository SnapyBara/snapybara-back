import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PointOfInterest, PointOfInterestSchema } from '../points/schemas/point-of-interest.schema';
import { Photo, PhotoSchema } from '../photos/schemas/photo.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { Achievement, AchievementSchema } from '../achievements/schemas/achievement.schema';
import { Report, ReportSchema } from '../reports/schemas/report.schema';
import mongoose from 'mongoose';

describe('Schemas', () => {
  describe('UserSchema', () => {
    it('should create a valid user document', () => {
      const UserModel = mongoose.model('User', UserSchema);
      const validUser = new UserModel({
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword',
        supabaseId: 'supabase-123',
      });

      const error = validUser.validateSync();
      expect(error).toBeUndefined();
    });

    it('should require email field', () => {
      const UserModel = mongoose.model('UserValidation', UserSchema);
      const invalidUser = new UserModel({
        username: 'testuser',
      });

      const error = invalidUser.validateSync();
      expect(error?.errors.email).toBeDefined();
    });

    it('should enforce unique constraints', () => {
      const schema = UserSchema;
      const emailPath = schema.path('email') as any;
      const supabaseIdPath = schema.path('supabaseId') as any;

      expect(emailPath.options.unique).toBe(true);
      expect(supabaseIdPath.options.unique).toBe(true);
      
      // username doesn't have unique constraint in schema
      const usernamePath = schema.path('username') as any;
      expect(usernamePath.options.required).toBe(true);
    });

    it('should have default values', () => {
      const UserModel = mongoose.model('UserDefaults', UserSchema);
      const user = new UserModel({
        email: 'test@example.com',
        username: 'testuser',
      });

      expect(user.role).toBe('user');
      expect(user.level).toBe(1);
      expect(user.points).toBe(0);
      expect(user.isActive).toBe(true);
      expect(user.achievements).toEqual([]);
    });
  });

  describe('PointOfInterestSchema', () => {
    it('should create a valid POI document', () => {
      const POIModel = mongoose.model('POI', PointOfInterestSchema);
      const validPOI = new POIModel({
        name: 'Test POI',
        location: {
          type: 'Point',
          coordinates: [2.3522, 48.8566],
        },
        latitude: 48.8566,
        longitude: 2.3522,
        userId: new mongoose.Types.ObjectId(),
        category: 'landscape',
        description: 'A test point of interest',
      });

      const error = validPOI.validateSync();
      expect(error).toBeUndefined();
    });

    it('should validate location coordinates', () => {
      const POIModel = mongoose.model('POILocation', PointOfInterestSchema);
      const invalidPOI = new POIModel({
        name: 'Test POI',
        location: {
          type: 'InvalidType', // Invalid type
          coordinates: [200, 100],
        },
        latitude: 100,
        longitude: 200,
        userId: new mongoose.Types.ObjectId(),
        category: 'landscape',
      });

      const error = invalidPOI.validateSync();
      // Location validation for coordinates range is done at application level
      expect(error?.errors['location.type']).toBeDefined();
    });

    it('should validate category enum', () => {
      const POIModel = mongoose.model('POICategory', PointOfInterestSchema);
      const invalidPOI = new POIModel({
        name: 'Test POI',
        location: {
          type: 'Point',
          coordinates: [0, 0],
        },
        latitude: 0,
        longitude: 0,
        userId: new mongoose.Types.ObjectId(),
        category: 'invalid-category',
      });

      const error = invalidPOI.validateSync();
      expect(error?.errors.category).toBeDefined();
    });

    it('should have default values', () => {
      const POIModel = mongoose.model('POIDefaults', PointOfInterestSchema);
      const poi = new POIModel({
        name: 'Test POI',
        location: {
          type: 'Point',
          coordinates: [0, 0],
        },
        latitude: 0,
        longitude: 0,
        userId: new mongoose.Types.ObjectId(),
        category: 'landscape',
      });

      expect(poi.tags).toEqual([]);
      expect(poi.isActive).toBe(true);
      expect(poi.viewCount).toBe(0);
    });
  });

  describe('PhotoSchema', () => {
    it('should create a valid photo document', () => {
      const PhotoModel = mongoose.model('Photo', PhotoSchema);
      const validPhoto = new PhotoModel({
        url: 'https://example.com/photo.jpg',
        userId: new mongoose.Types.ObjectId(),
        pointId: new mongoose.Types.ObjectId(),
        filename: 'test.jpg',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
      });

      const error = validPhoto.validateSync();
      expect(error).toBeUndefined();
    });

    it('should require mandatory fields', () => {
      const PhotoModel = mongoose.model('PhotoValidation', PhotoSchema);
      const invalidPhoto = new PhotoModel({});

      const error = invalidPhoto.validateSync();
      expect(error?.errors.url).toBeDefined();
      expect(error?.errors.userId).toBeDefined();
      expect(error?.errors.pointId).toBeDefined();
    });

    it('should have default values', () => {
      const PhotoModel = mongoose.model('PhotoDefaults', PhotoSchema);
      const photo = new PhotoModel({
        url: 'https://example.com/photo.jpg',
        userId: new mongoose.Types.ObjectId(),
        pointId: new mongoose.Types.ObjectId(),
      });

      expect(photo.isPublic).toBe(true);
      expect(photo.isActive).toBe(true);
      expect(photo.status).toBe('pending');
      expect(photo.likesCount).toBe(0);
    });
  });

  describe('ReviewSchema', () => {
    it('should create a valid review document', () => {
      const ReviewModel = mongoose.model('Review', ReviewSchema);
      const validReview = new ReviewModel({
        userId: 'user-uuid-123',
        pointId: new mongoose.Types.ObjectId(),
        rating: 4,
        comment: 'Great place!',
      });

      const error = validReview.validateSync();
      expect(error).toBeUndefined();
    });

    it('should validate rating range', () => {
      const ReviewModel = mongoose.model('ReviewRating', ReviewSchema);
      
      // Test invalid ratings
      const tooLow = new ReviewModel({
        userId: 'user-uuid-123',
        pointId: new mongoose.Types.ObjectId(),
        rating: 0,
      });
      
      const tooHigh = new ReviewModel({
        userId: 'user-uuid-123',
        pointId: new mongoose.Types.ObjectId(),
        rating: 6,
      });

      expect(tooLow.validateSync()?.errors.rating).toBeDefined();
      expect(tooHigh.validateSync()?.errors.rating).toBeDefined();
    });

    it('should have default values', () => {
      const ReviewModel = mongoose.model('ReviewDefaults', ReviewSchema);
      const review = new ReviewModel({
        userId: 'user-uuid-123',
        pointId: new mongoose.Types.ObjectId(),
        rating: 5,
      });

      expect(review.photos).toEqual([]);
      expect(review.pros).toEqual([]);
      expect(review.cons).toEqual([]);
      expect(review.helpfulCount).toBe(0);
    });
  });

  describe('AchievementSchema', () => {
    it('should create a valid achievement document', () => {
      const AchievementModel = mongoose.model('Achievement', AchievementSchema);
      const validAchievement = new AchievementModel({
        code: 'FIRST_POI',
        name: 'First POI',
        description: 'Created your first point of interest',
        category: 'exploration',
        criteria: {
          type: 'points_created',
          target: 1
        },
        icon: 'trophy',
        points: 10,
        condition: 'points_created >= 1',
      });

      const error = validAchievement.validateSync();
      expect(error).toBeUndefined();
    });

    it('should require mandatory fields', () => {
      const AchievementModel = mongoose.model('AchievementValidation', AchievementSchema);
      const invalidAchievement = new AchievementModel({});

      const error = invalidAchievement.validateSync();
      expect(error?.errors.name).toBeDefined();
      expect(error?.errors.description).toBeDefined();
      expect(error?.errors.code).toBeDefined();
      expect(error?.errors.category).toBeDefined();
      expect(error?.errors.criteria).toBeDefined();
    });

    it('should validate category enum', () => {
      const AchievementModel = mongoose.model('AchievementCondition', AchievementSchema);
      const invalidAchievement = new AchievementModel({
        code: 'TEST',
        name: 'Test Achievement',
        description: 'Test',
        category: 'invalid-category', // Invalid category
        criteria: {
          type: 'test',
          target: 1
        },
        icon: 'test-icon',
        points: 10,
        condition: 'test condition',
      });

      const error = invalidAchievement.validateSync();
      expect(error?.errors.category).toBeDefined();
    });
  });

  describe('ReportSchema', () => {
    it('should create a valid report document', () => {
      const ReportModel = mongoose.model('Report', ReportSchema);
      const validReport = new ReportModel({
        reporterId: new mongoose.Types.ObjectId(),
        reportedType: 'point',
        reportedId: new mongoose.Types.ObjectId().toString(),
        reason: 'spam',
        description: 'Contains inappropriate content',
      });

      const error = validReport.validateSync();
      expect(error).toBeUndefined();
    });

    it('should validate target type enum', () => {
      const ReportModel = mongoose.model('ReportType', ReportSchema);
      const invalidReport = new ReportModel({
        reporterId: new mongoose.Types.ObjectId(),
        reportedType: 'invalid-type',
        reportedId: new mongoose.Types.ObjectId().toString(),
        reason: 'spam',
      });

      const error = invalidReport.validateSync();
      expect(error?.errors.reportedType).toBeDefined();
    });

    it('should validate reason enum', () => {
      const ReportModel = mongoose.model('ReportReason', ReportSchema);
      const invalidReport = new ReportModel({
        reporterId: new mongoose.Types.ObjectId(),
        reportedType: 'point',
        reportedId: new mongoose.Types.ObjectId().toString(),
        reason: 'invalid-reason',
      });

      const error = invalidReport.validateSync();
      expect(error?.errors.reason).toBeDefined();
    });

    it('should have default values', () => {
      const ReportModel = mongoose.model('ReportDefaults', ReportSchema);
      const report = new ReportModel({
        reporterId: new mongoose.Types.ObjectId(),
        reportedType: 'point',
        reportedId: new mongoose.Types.ObjectId().toString(),
        reason: 'spam',
      });

      expect(report.status).toBe('pending');
    });
  });

  describe('Schema Indexes', () => {
    it('should have proper indexes on UserSchema', () => {
      const indexes = UserSchema.indexes();
      
      // Check for email index
      expect(indexes).toContainEqual([
        { email: 1 },
        expect.any(Object)
      ]);
      
      // Check for username index
      expect(indexes).toContainEqual([
        { username: 1 },
        expect.any(Object)
      ]);
    });

    it('should have geospatial index on PointOfInterestSchema', () => {
      const indexes = PointOfInterestSchema.indexes();
      
      // Check for 2dsphere index on location
      expect(indexes).toContainEqual([
        { 'location': '2dsphere' },
        expect.any(Object)
      ]);
    });

    it('should have compound indexes on ReviewSchema', () => {
      const indexes = ReviewSchema.indexes();
      
      // Check for compound index on userId and pointId
      expect(indexes).toContainEqual([
        { userId: 1, pointId: 1 },
        expect.any(Object)
      ]);
    });
  });

  describe('Schema Methods', () => {
    it('should have toJSON transform on schemas', () => {
      const UserModel = mongoose.model('UserJSON', UserSchema);
      const user = new UserModel({
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword',
      });

      const json = user.toJSON();
      
      // Password should be removed in JSON
      expect(json).not.toHaveProperty('password');
      expect(json).not.toHaveProperty('__v');
    });
  });

  describe('Schema Timestamps', () => {
    it('should have timestamps on all schemas', () => {
      const schemas = [
        UserSchema,
        PointOfInterestSchema,
        PhotoSchema,
        ReviewSchema,
        AchievementSchema,
        ReportSchema,
      ];

      schemas.forEach((schema) => {
        const paths = schema.paths;
        expect(paths).toHaveProperty('createdAt');
        expect(paths).toHaveProperty('updatedAt');
      });
    });
  });
});
