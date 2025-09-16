import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // Points pour différentes actions
  private readonly POINTS_CONFIG = {
    POI_CREATED: 10,
    POI_VALIDATED: 15,
    POI_REJECTED: 0,
    PHOTO_UPLOADED: 5,
    REVIEW_CREATED: 3,
    COLLECTION_CREATED: 5,
    FIRST_LOGIN: 50,
    DAILY_LOGIN: 2,
  };

  // Achievements définis
  private readonly ACHIEVEMENTS = {
    first_login: { name: 'Première connexion', points: 50 },
    first_photo: { name: 'Première photo', points: 10 },
    first_review: { name: 'Premier avis', points: 10 },
    explorer_10: { name: 'Explorateur', points: 25 },
    photographer_25: { name: 'Photographe amateur', points: 50 },
    reviewer_10: { name: 'Critique', points: 30 },
    collector_5: { name: 'Collectionneur', points: 20 },
    level_5: { name: 'Niveau 5', points: 100 },
    level_10: { name: 'Niveau 10', points: 200 },
  };

  async awardPointsForPOICreation(userId: string): Promise<void> {
    try {
      const points = this.POINTS_CONFIG.POI_CREATED;
      const user = await this.usersService.addPoints(userId, points);
      
      this.logger.log(`Awarded ${points} points to user ${userId} for POI creation`);
      
      // Envoyer notification WebSocket
      await this.notificationsGateway.notifyPointsEarned(
        userId,
        points,
        'création d\'un point d\'intérêt',
        user.points,
      );

      // Vérifier si un nouveau niveau est atteint
      await this.checkLevelUp(userId, user.points);
    } catch (error) {
      this.logger.error(`Failed to award points for POI creation: ${error.message}`);
    }
  }

  async awardPointsForPOIValidation(userId: string): Promise<void> {
    try {
      const points = this.POINTS_CONFIG.POI_VALIDATED;
      const user = await this.usersService.addPoints(userId, points);
      
      // Incrémenter le compteur de POI
      await this.usersService.incrementPOICount(userId);
      
      this.logger.log(`Awarded ${points} points to user ${userId} for POI validation`);
      
      // Envoyer notification WebSocket
      await this.notificationsGateway.notifyPointsEarned(
        userId,
        points,
        'validation d\'un point d\'intérêt',
        user.points,
      );
      
      // Check for achievements
      await this.checkAchievements(userId, 'poi_validated');
      await this.checkLevelUp(userId, user.points);
    } catch (error) {
      this.logger.error(`Failed to award points for POI validation: ${error.message}`);
    }
  }

  async awardPointsForPhotoUpload(userId: string): Promise<void> {
    try {
      const points = this.POINTS_CONFIG.PHOTO_UPLOADED;
      const user = await this.usersService.addPoints(userId, points);
      
      // Incrémenter le compteur de photos
      await this.usersService.incrementPhotoCount(userId);
      
      this.logger.log(`Awarded ${points} points to user ${userId} for photo upload`);
      
      // Envoyer notification WebSocket
      await this.notificationsGateway.notifyPointsEarned(
        userId,
        points,
        'téléchargement d\'une photo',
        user.points,
      );

      // Vérifier les achievements liés aux photos
      await this.checkPhotoAchievements(userId);
      await this.checkLevelUp(userId, user.points);
    } catch (error) {
      this.logger.error(`Failed to award points for photo upload: ${error.message}`);
    }
  }

  async awardPointsForReview(userId: string): Promise<void> {
    try {
      const points = this.POINTS_CONFIG.REVIEW_CREATED;
      const user = await this.usersService.addPoints(userId, points);
      
      // Incrémenter le compteur de reviews
      await this.usersService.incrementCommentCount(userId);
      
      this.logger.log(`Awarded ${points} points to user ${userId} for review creation`);
      
      // Envoyer notification WebSocket
      await this.notificationsGateway.notifyPointsEarned(
        userId,
        points,
        'création d\'un avis',
        user.points,
      );

      // Vérifier les achievements liés aux reviews
      await this.checkReviewAchievements(userId);
      await this.checkLevelUp(userId, user.points);
    } catch (error) {
      this.logger.error(`Failed to award points for review: ${error.message}`);
    }
  }

  private async checkLevelUp(userId: string, currentPoints: number): Promise<void> {
    // Calculer le niveau actuel (100 points par niveau)
    const newLevel = Math.floor(currentPoints / 100) + 1;
    const user = await this.usersService.findById(userId);
    
    if (user && user.level < newLevel) {
      // Mettre à jour le niveau
      await this.usersService.updateLevel(userId, newLevel);
      
      // Envoyer notification de level up
      await this.notificationsGateway.notifyLevelUp(userId, newLevel);
      
      // Vérifier les achievements de niveau
      if (newLevel === 5 && !user.achievements?.includes('level_5')) {
        await this.unlockAchievement(userId, 'level_5');
      } else if (newLevel === 10 && !user.achievements?.includes('level_10')) {
        await this.unlockAchievement(userId, 'level_10');
      }
      
      this.logger.log(`User ${userId} reached level ${newLevel}`);
    }
  }

  private async checkPhotoAchievements(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) return;

    // Pour l'instant, on utilise le compteur dans le user schema
    const photoCount = user.photosUploaded || 0;

    // First photo achievement
    if (photoCount === 1 && !user.achievements?.includes('first_photo')) {
      await this.unlockAchievement(userId, 'first_photo');
    }

    // 25 photos achievement
    if (photoCount >= 25 && !user.achievements?.includes('photographer_25')) {
      await this.unlockAchievement(userId, 'photographer_25');
    }
  }

  private async checkReviewAchievements(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) return;

    // Pour l'instant, on utilise le compteur dans le user schema
    const reviewCount = user.commentsWritten || 0;

    // First review achievement
    if (reviewCount === 1 && !user.achievements?.includes('first_review')) {
      await this.unlockAchievement(userId, 'first_review');
    }

    // 10 reviews achievement
    if (reviewCount >= 10 && !user.achievements?.includes('reviewer_10')) {
      await this.unlockAchievement(userId, 'reviewer_10');
    }
  }

  private async checkAchievements(userId: string, action: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) return;

    // Vérifier différents achievements selon l'action
    switch (action) {
      case 'poi_validated':
        const poiCount = user.pointsOfInterestCreated || 0;
        if (poiCount >= 10 && !user.achievements?.includes('explorer_10')) {
          await this.unlockAchievement(userId, 'explorer_10');
        }
        break;
      case 'collection_created':
        // TODO: Ajouter un compteur de collections dans le schema User
        // Pour l'instant, on skip cette vérification
        break;
    }
  }

  private async unlockAchievement(userId: string, achievementId: string): Promise<void> {
    const achievement = this.ACHIEVEMENTS[achievementId];
    if (!achievement) return;

    try {
      // Ajouter l'achievement à l'utilisateur
      await this.usersService.addAchievement(userId, achievementId);
      
      // Ajouter les points bonus
      await this.usersService.addPoints(userId, achievement.points);
      
      // Envoyer notification
      await this.notificationsGateway.notifyAchievementUnlocked(userId, {
        id: achievementId,
        name: achievement.name,
        description: `Vous avez débloqué le succès "${achievement.name}"`,
        points: achievement.points,
      });
      
      this.logger.log(`User ${userId} unlocked achievement: ${achievementId}`);
    } catch (error) {
      this.logger.error(`Failed to unlock achievement ${achievementId}: ${error.message}`);
    }
  }
}
