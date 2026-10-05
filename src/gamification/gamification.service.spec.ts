import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from './gamification.service';
import { UsersService } from '../users/users.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

describe('GamificationService', () => {
  let service: GamificationService;
  const userId = 'user-1';

  const usersService = {
    addPoints: jest.fn(),
    findById: jest.fn(),
    updateLevel: jest.fn(),
    addAchievement: jest.fn(),
    incrementPOICount: jest.fn(),
    incrementPhotoCount: jest.fn(),
    incrementCommentCount: jest.fn(),
  };

  const gateway = {
    notifyPointsEarned: jest.fn(),
    notifyLevelUp: jest.fn(),
    notifyAchievementUnlocked: jest.fn(),
  };

  const mockUser = (overrides: Record<string, any> = {}) => ({
    level: 1,
    achievements: [],
    photosUploaded: 0,
    commentsWritten: 0,
    pointsOfInterestCreated: 0,
    ...overrides,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: UsersService, useValue: usersService },
        { provide: NotificationsGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(GamificationService);
    usersService.addPoints.mockResolvedValue({ points: 20 });
    usersService.findById.mockResolvedValue(mockUser());
  });

  describe('awardPointsForPOICreation', () => {
    it('awards points and notifies the user', async () => {
      await service.awardPointsForPOICreation(userId);

      expect(usersService.addPoints).toHaveBeenCalledWith(userId, 10);
      expect(gateway.notifyPointsEarned).toHaveBeenCalledWith(
        userId,
        10,
        expect.any(String),
        20,
      );
    });

    it('swallows errors', async () => {
      usersService.addPoints.mockRejectedValue(new Error('db down'));

      await expect(
        service.awardPointsForPOICreation(userId),
      ).resolves.toBeUndefined();
      expect(gateway.notifyPointsEarned).not.toHaveBeenCalled();
    });
  });

  describe('level up', () => {
    it('updates the level and notifies when the computed level is higher', async () => {
      usersService.addPoints.mockResolvedValue({ points: 250 });

      await service.awardPointsForPOICreation(userId);

      expect(usersService.updateLevel).toHaveBeenCalledWith(userId, 3);
      expect(gateway.notifyLevelUp).toHaveBeenCalledWith(userId, 3);
    });

    it('does nothing when the level is unchanged', async () => {
      usersService.findById.mockResolvedValue(mockUser({ level: 3 }));
      usersService.addPoints.mockResolvedValue({ points: 250 });

      await service.awardPointsForPOICreation(userId);

      expect(usersService.updateLevel).not.toHaveBeenCalled();
      expect(gateway.notifyLevelUp).not.toHaveBeenCalled();
    });

    it.each([
      [450, 'level_5'],
      [950, 'level_10'],
    ])('unlocks the level achievement at %i points', async (points, id) => {
      usersService.addPoints.mockResolvedValue({ points });

      await service.awardPointsForPOICreation(userId);

      expect(usersService.addAchievement).toHaveBeenCalledWith(userId, id);
      expect(gateway.notifyAchievementUnlocked).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ id }),
      );
    });
  });

  describe('awardPointsForPOIValidation', () => {
    it('increments the POI count and unlocks explorer_10', async () => {
      usersService.findById.mockResolvedValue(
        mockUser({ pointsOfInterestCreated: 10, level: 5 }),
      );

      await service.awardPointsForPOIValidation(userId);

      expect(usersService.addPoints).toHaveBeenCalledWith(userId, 15);
      expect(usersService.incrementPOICount).toHaveBeenCalledWith(userId);
      expect(usersService.addAchievement).toHaveBeenCalledWith(
        userId,
        'explorer_10',
      );
    });

    it('does not unlock explorer_10 twice', async () => {
      usersService.findById.mockResolvedValue(
        mockUser({
          pointsOfInterestCreated: 12,
          achievements: ['explorer_10'],
          level: 5,
        }),
      );

      await service.awardPointsForPOIValidation(userId);

      expect(usersService.addAchievement).not.toHaveBeenCalled();
    });

    it('skips achievements when the user is missing', async () => {
      usersService.findById.mockResolvedValue(null);

      await service.awardPointsForPOIValidation(userId);

      expect(usersService.addAchievement).not.toHaveBeenCalled();
      expect(usersService.updateLevel).not.toHaveBeenCalled();
    });

    it('swallows errors', async () => {
      usersService.incrementPOICount.mockRejectedValue(new Error('fail'));

      await expect(
        service.awardPointsForPOIValidation(userId),
      ).resolves.toBeUndefined();
    });
  });

  describe('awardPointsForPhotoUpload', () => {
    it.each([
      [1, 'first_photo'],
      [25, 'photographer_25'],
    ])('unlocks the photo achievement for %i photos', async (count, id) => {
      usersService.findById.mockResolvedValue(
        mockUser({ photosUploaded: count, level: 5 }),
      );

      await service.awardPointsForPhotoUpload(userId);

      expect(usersService.addPoints).toHaveBeenCalledWith(userId, 5);
      expect(usersService.incrementPhotoCount).toHaveBeenCalledWith(userId);
      expect(usersService.addAchievement).toHaveBeenCalledWith(userId, id);
    });

    it('skips photo achievements when the user is missing', async () => {
      usersService.findById.mockResolvedValue(null);

      await service.awardPointsForPhotoUpload(userId);

      expect(usersService.addAchievement).not.toHaveBeenCalled();
    });

    it('swallows errors', async () => {
      usersService.addPoints.mockRejectedValue(new Error('fail'));

      await expect(
        service.awardPointsForPhotoUpload(userId),
      ).resolves.toBeUndefined();
    });
  });

  describe('awardPointsForReview', () => {
    it.each([
      [1, 'first_review'],
      [10, 'reviewer_10'],
    ])('unlocks the review achievement for %i reviews', async (count, id) => {
      usersService.findById.mockResolvedValue(
        mockUser({ commentsWritten: count, level: 5 }),
      );

      await service.awardPointsForReview(userId);

      expect(usersService.addPoints).toHaveBeenCalledWith(userId, 3);
      expect(usersService.incrementCommentCount).toHaveBeenCalledWith(userId);
      expect(usersService.addAchievement).toHaveBeenCalledWith(userId, id);
    });

    it('skips review achievements when the user is missing', async () => {
      usersService.findById.mockResolvedValue(null);

      await service.awardPointsForReview(userId);

      expect(usersService.addAchievement).not.toHaveBeenCalled();
    });

    it('swallows errors', async () => {
      usersService.addPoints.mockRejectedValue(new Error('fail'));

      await expect(
        service.awardPointsForReview(userId),
      ).resolves.toBeUndefined();
    });
  });

  describe('unlockAchievement', () => {
    it('logs and continues when unlocking fails', async () => {
      usersService.findById.mockResolvedValue(
        mockUser({ photosUploaded: 1, level: 5 }),
      );
      usersService.addAchievement.mockRejectedValue(new Error('fail'));

      await expect(
        service.awardPointsForPhotoUpload(userId),
      ).resolves.toBeUndefined();
      expect(gateway.notifyAchievementUnlocked).not.toHaveBeenCalled();
    });
  });
});
